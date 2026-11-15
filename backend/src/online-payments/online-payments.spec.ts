import { BadRequestException, ConflictException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { OnlineOrderExpiryWorker } from '../orders/online-order-expiry.worker';
import { GatewayPayoutsService } from './gateway-payouts.service';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { OrderPaymentStatus, OrderStatus, PaymentMethod } from '../orders/enums/order-status.enum';
import { PLAN_MODULES, StoreModule, StorePlan } from '../common/tenant/store-plan';
import { withTransaction } from '../common/tenant/with-transaction';
import { ACCOUNT } from '../finance/accounts';
import { Custody, GatewayRefundState } from '../finance/schemas/payment.schema';
import { OnlinePaymentsService } from './online-payments.service';
import { AttemptStatus } from './schemas/payment-attempt.schema';
import { WebhookEvent } from './providers/payment-provider';
import { RefundMethod, RefundReason, RefundStatus } from '../refunds/schemas/refund.schema';

jest.setTimeout(180_000);

/**
 * Money that arrives through a gateway before delivery is a customer deposit,
 * not a receivable; delivery then settles the receivable with it. The books
 * must reconcile at every step, and a repeated or odd notice must never book
 * twice or book money the order can't take.
 */
describe('Online payments', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let store: Store;

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all(db.modelNames().map((name) => db.model(name).deleteMany({})));
    await db.model('Payment').syncIndexes();
    store = buildStore(db);
    store.delivery.price = 45;
    // Cancelling asks this service to send paid money back; suites that test that replace it with a real one.
    (store.orders as any).onlinePayments = { refundCancelled: async () => undefined, hasAttemptSince: async () => false };
  });

  /** An order for 2 × 150.00 + 45.00 delivery = 345.00, marked as paid online. */
  const onlineOrder = async () => {
    const product = await store.product(150, 10, 90);
    const customer = await store.customer();
    const placed = (await store.place(customer, [{ productId: product, quantity: 2 }])) as any;
    await db.model('Order').updateOne({ _id: placed._id }, { paymentMethod: PaymentMethod.ONLINE });
    return String(placed._id);
  };

  const pay = (orderId: string, amountMinor: number, transactionId = 'tx-1', keepsBooks = true) =>
    withTransaction(db, (session) =>
      store.payments.recordGatewayPayment(orderId, { amountMinor, provider: 'paymob', transactionId, keepsBooks }, session),
    );

  const order = (id: string) => db.model('Order').findById(id).lean().exec() as Promise<any>;
  const balances = () => store.journal.balances();
  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };

  describe('booking', () => {
    it('holds a payment taken before delivery as a deposit, then settles the receivable on delivery', async () => {
      const id = await onlineOrder();
      const payment = await pay(id, 34500);

      expect(payment).toMatchObject({ custody: Custody.GATEWAY, method: PaymentMethod.ONLINE, heldAsDeposit: true });
      expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID, money: { collectedMinor: 34500, depositMinor: 34500 } });
      // Money at the gateway, owed to the customer in goods: not yet a sale.
      expect(await balances()).toMatchObject({ [ACCOUNT.GATEWAY_BALANCE]: 34500, [ACCOUNT.CUSTOMER_DEPOSITS]: 34500, [ACCOUNT.RECEIVABLES]: 0 });
      await reconciled();

      const delivered = await store.advance(id);
      expect(delivered).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID, money: { collectedMinor: 34500, depositMinor: 0 } });
      expect(await db.model('Payment').findOne({ order: id }).lean()).toMatchObject({ heldAsDeposit: false });
      // The sale is recognised and already paid: no receivable, no deposit left, the gateway still holds the cash.
      expect(await balances()).toMatchObject({
        [ACCOUNT.GATEWAY_BALANCE]: 34500,
        [ACCOUNT.CUSTOMER_DEPOSITS]: 0,
        [ACCOUNT.RECEIVABLES]: 0,
        [ACCOUNT.PRODUCT_SALES]: 30000,
        [ACCOUNT.DELIVERY_INCOME]: 4500,
      });
      await reconciled();
    });

    it('settles the receivable directly when the payment comes after delivery', async () => {
      const id = await onlineOrder();
      await store.advance(id);
      expect(await balances()).toMatchObject({ [ACCOUNT.RECEIVABLES]: 34500 });

      const payment = await pay(id, 34500);
      expect(payment.heldAsDeposit).toBe(false);
      expect(await balances()).toMatchObject({ [ACCOUNT.RECEIVABLES]: 0, [ACCOUNT.GATEWAY_BALANCE]: 34500, [ACCOUNT.CUSTOMER_DEPOSITS]: 0 });
      expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID });
      await reconciled();
    });

    it('keeps no entries for a store without the books, just the payment and the paid status', async () => {
      const id = await onlineOrder();
      await pay(id, 34500, 'tx-1', false);
      expect(await db.model('JournalEntry').countDocuments({ 'source.type': 'payment' })).toBe(0);
      expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID, money: { collectedMinor: 34500, depositMinor: 0 } });
    });

    it('refuses more than the order still owes', async () => {
      const id = await onlineOrder();
      await expect(pay(id, 34501)).rejects.toThrow(ConflictException);
      await pay(id, 10000, 'tx-1');
      await expect(pay(id, 24501, 'tx-2')).rejects.toThrow(ConflictException);
      expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.PARTIALLY_PAID });
    });

    it('books one gateway transaction only once', async () => {
      const id = await onlineOrder();
      await pay(id, 10000, 'tx-1');
      await expect(pay(id, 10000, 'tx-1')).rejects.toThrow();
      expect(await db.model('Payment').countDocuments({ order: id })).toBe(1);
    });
  });

  describe('guards', () => {
    it('still cancels an online order nobody paid', async () => {
      const id = await onlineOrder();
      await store.orders.updateStatus(id, OrderStatus.CANCELLED, undefined, undefined, 'shop.test');
      expect(await order(id)).toMatchObject({ status: OrderStatus.CANCELLED });
    });

    it('does not let staff record cash against an online order', async () => {
      const id = await onlineOrder();
      await store.advance(id);
      await expect(store.payments.recordCollection(id, { amount: '345.00', custody: Custody.STORE })).rejects.toThrow(BadRequestException);
    });
  });

  describe('expiring unpaid orders', () => {
    const worker = () => new OnlineOrderExpiryWorker(db.model('Order') as never, store.orders);
    const age = (id: string, minutes: number) =>
      db.model('Order').collection.updateOne({ _id: new Types.ObjectId(id) }, { $set: { createdAt: new Date(Date.now() - minutes * 60_000) } });
    const stockOf = async (orderId: string) => {
      const o = await order(orderId);
      return ((await db.model('Product').findById(o.items[0].product).lean().exec()) as any).stock;
    };

    it('cancels an old unpaid online order and puts its stock back', async () => {
      const id = await onlineOrder();
      expect(await stockOf(id)).toBe(8);
      await age(id, 45);

      expect(await worker().run('shop.test', 30 * 60_000)).toBe(1);
      expect(await order(id)).toMatchObject({ status: OrderStatus.CANCELLED });
      expect(await stockOf(id)).toBe(10);
    });

    it('leaves a recent order alone', async () => {
      const id = await onlineOrder();
      await age(id, 5);
      expect(await worker().run('shop.test', 30 * 60_000)).toBe(0);
      expect(await order(id)).toMatchObject({ status: OrderStatus.PENDING });
    });

    it('leaves alone an order the customer is still trying to pay', async () => {
      const id = await onlineOrder();
      await age(id, 45);
      (store.orders as any).onlinePayments.hasAttemptSince = async () => true;
      expect(await worker().run('shop.test', 30 * 60_000)).toBe(0);
      expect(await order(id)).toMatchObject({ status: OrderStatus.PENDING });
    });

    it('never cancels an order that has been paid', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      await age(id, 45);
      expect(await worker().run('shop.test', 30 * 60_000)).toBe(0);
      expect(await order(id)).toMatchObject({ status: OrderStatus.PENDING });
    });

    it('never cancels a cash order, or one the store already took', async () => {
      const cash = (await store.place(await store.customer(), [{ productId: await store.product(100), quantity: 1 }])) as any;
      const taken = await onlineOrder();
      await store.orders.updateStatus(taken, OrderStatus.CONFIRMED, undefined, undefined, 'shop.test');
      await age(String(cash._id), 90);
      await age(taken, 90);
      expect(await worker().run('shop.test', 30 * 60_000)).toBe(0);
      expect(await order(taken)).toMatchObject({ status: OrderStatus.CONFIRMED });
    });
  });

  describe('refunding a delivered order through the gateway', () => {
    const alice = String(new Types.ObjectId());
    let send: jest.Mock;

    beforeEach(() => {
      send = jest.fn().mockResolvedValue(undefined);
      (store.refunds as any).onlinePayments = { sendRefund: send, notifyRefunded: async () => undefined };
    });

    /** Delivered, and paid online in `parts` (default one payment of 345.00). */
    const delivered = async (parts = [34500]) => {
      const id = await onlineOrder();
      for (const [i, amount] of parts.entries()) await pay(id, amount, `tx-${i + 1}`);
      await store.advance(id);
      return id;
    };
    const ask = (orderId: string, quantity = 1) =>
      store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.GATEWAY } as never,
        alice,
      );
    const refundDoc = (id: unknown) => db.model('Refund').findById(id).lean().exec() as Promise<any>;

    it('sends the money back through the payment it came in on and keeps the books straight', async () => {
      const id = await delivered();
      const refund = await ask(id);
      expect(refund.status).toBe(RefundStatus.APPROVED);

      const done = await store.refunds.execute(String(refund._id), alice, 'shop.test');
      expect(done).toMatchObject({ status: RefundStatus.EXECUTED, gatewayState: GatewayRefundState.DONE });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][1]).toBe(15000);

      expect(await order(id)).toMatchObject({ money: { refundedMinor: 15000, cashRefundedMinor: 15000 } });
      expect((await balances())[ACCOUNT.GATEWAY_BALANCE]).toBe(34500 - 15000);
      await reconciled();
    });

    it('keeps the refund executed and retryable when the gateway fails, and sends it once on retry', async () => {
      const id = await delivered();
      const refund = await ask(id);
      send.mockRejectedValueOnce(new Error('Paymob is down'));

      const failed = await store.refunds.execute(String(refund._id), alice, 'shop.test');
      expect(failed).toMatchObject({ status: RefundStatus.EXECUTED, gatewayState: GatewayRefundState.FAILED, gatewayNote: 'Paymob is down' });

      const retried = await store.refunds.sendToGateway(String(refund._id));
      expect(retried.gatewayState).toBe(GatewayRefundState.DONE);
      expect(send).toHaveBeenCalledTimes(2);
      await expect(store.refunds.sendToGateway(String(refund._id))).rejects.toThrow(ConflictException);
      expect(send).toHaveBeenCalledTimes(2);
      await reconciled();
    });

    describe('stuck in progress', () => {
      const stuck = async () => {
        const id = await delivered();
        const refund = await ask(id);
        await store.refunds.execute(String(refund._id), alice, 'shop.test');
        await db.model('Refund').updateOne({ _id: refund._id }, { $set: { gatewayState: GatewayRefundState.PROCESSING } });
        return String(refund._id);
      };

      it('is settled as sent: marked done and the customer told, and no longer open to a second settling', async () => {
        const id = await stuck();
        const told = jest.fn().mockResolvedValue(undefined);
        (store.refunds as any).onlinePayments = { sendRefund: send, notifyRefunded: told };
        await expect(store.refunds.sendToGateway(id)).rejects.toThrow(ConflictException);

        expect((await store.refunds.resolveGateway(id, 'sent')).gatewayState).toBe(GatewayRefundState.DONE);
        expect(told).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
        await expect(store.refunds.resolveGateway(id, 'not_sent')).rejects.toThrow(ConflictException);
      });

      it('is settled as not sent: failed with the reason, then it can be sent again or reversed', async () => {
        const id = await stuck();

        const failed = await store.refunds.resolveGateway(id, 'not_sent', 'nothing in Paymob');
        expect(failed.gatewayState).toBe(GatewayRefundState.FAILED);
        expect(failed.gatewayNote).toContain('nothing in Paymob');

        expect((await store.refunds.sendToGateway(id)).gatewayState).toBe(GatewayRefundState.DONE);
        expect(send).toHaveBeenCalledTimes(2);
      });
    });

    it('can still be reversed while the gateway has not sent it, but not after', async () => {
      const id = await delivered();
      const pending = await ask(id);
      send.mockRejectedValueOnce(new Error('down'));
      await store.refunds.execute(String(pending._id), alice, 'shop.test');
      await store.refunds.reverse(String(pending._id), 'gateway never took it', alice);
      expect((await refundDoc(pending._id)).status).toBe(RefundStatus.REVERSED);
      await reconciled();

      const sent = await ask(id);
      await store.refunds.execute(String(sent._id), alice, 'shop.test');
      await expect(store.refunds.reverse(String(sent._id), 'oops', alice)).rejects.toThrow(ConflictException);
    });

    it('refuses a refund no single online payment has room for', async () => {
      const id = await delivered([20000, 14500]);
      await expect(ask(id, 2)).rejects.toThrow(ConflictException);
    });

    it('goes back through the smallest payment that can take it', async () => {
      const id = await delivered([20000, 14500]);
      const refund = await ask(id);
      const payment = (await db.model('Payment').findOne({ order: id, amountMinor: 20000 }).lean().exec()) as any;
      expect(String(refund.gatewayPayment)).toBe(String(payment!._id));
    });

    it('never counts one payment twice across two refunds', async () => {
      const id = await delivered([19500, 15000]);
      const first = await ask(id);
      const second = await ask(id);
      expect(String(second.gatewayPayment)).not.toBe(String(first.gatewayPayment));
      // Both units are now spoken for, and so is the money of both payments.
      await expect(ask(id)).rejects.toThrow();
    });
  });

  describe('gateway balance in the books', () => {
    const gatewayCheck = async () =>
      (await store.reconciliation.run()).checks.find((c) => c.name === 'Gateway balance equals online payments less what went back')!;

    it('holds what the gateway took, and lets go of what it sent back', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      expect((await gatewayCheck()).ok).toBe(true);
      expect((await balances())[ACCOUNT.GATEWAY_BALANCE]).toBe(34500);
    });

    it('goes red when a payment exists that the books never saw', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      await db.model('Payment').collection.updateOne({ order: new Types.ObjectId(id) }, { $set: { amountMinor: 40000 } });
      const check = await gatewayCheck();
      expect(check.ok).toBe(false);
      expect(check.offenders[0]).toContain('34500');
    });
  });

  describe('gateway payouts', () => {
    const payouts = () => new GatewayPayoutsService(db.model('GatewayPayout') as never, db.model('Counter') as never, db, store.journal);
    const bank = async () => String((await db.model('MoneyAccount').create({ name: 'Bank', type: 'bank' }))._id);
    const gatewayCheck = async () =>
      (await store.reconciliation.run()).checks.find((c) => c.name === 'Gateway balance equals online payments less what went back')!;
    const today = () => new Date().toISOString().slice(0, 10);

    it('moves what the gateway held into the bank, less the fees it kept', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      const payout = await payouts().record({ date: today(), grossAmount: '345.00', feeAmount: '10.00', moneyAccountId: await bank() }, undefined);

      expect(payout).toMatchObject({ payoutNumber: 1, grossMinor: 34500, feeMinor: 1000, netMinor: 33500 });
      const balances = await store.journal.balances();
      expect(balances[ACCOUNT.GATEWAY_BALANCE]).toBe(0);
      expect(balances[ACCOUNT.FEES]).toBe(1000);
      expect((await gatewayCheck()).ok).toBe(true);
      await reconciled();
    });

    it('takes out only part of what is held, and refuses more than that', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      const account = await bank();
      await payouts().record({ date: today(), grossAmount: '200.00', moneyAccountId: account }, undefined);
      expect((await store.journal.balances())[ACCOUNT.GATEWAY_BALANCE]).toBe(14500);
      await expect(payouts().record({ date: today(), grossAmount: '145.01', moneyAccountId: account }, undefined)).rejects.toThrow(ConflictException);
      await reconciled();
    });

    it('refuses fees above the payout, a zero payout and a date in the future', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      const account = await bank();
      await expect(payouts().record({ date: today(), grossAmount: '10.00', feeAmount: '11.00', moneyAccountId: account }, undefined)).rejects.toThrow(BadRequestException);
      await expect(payouts().record({ date: today(), grossAmount: '0', moneyAccountId: account }, undefined)).rejects.toThrow(BadRequestException);
      const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
      await expect(payouts().record({ date: future, grossAmount: '10.00', moneyAccountId: account }, undefined)).rejects.toThrow(BadRequestException);
    });

    it('can be reversed once, and the gateway holds the money again', async () => {
      const id = await onlineOrder();
      await pay(id, 34500);
      const payout = await payouts().record({ date: today(), grossAmount: '345.00', feeAmount: '5.00', moneyAccountId: await bank() }, undefined);

      await payouts().reverse(String(payout._id), 'entered twice', undefined);
      expect((await store.journal.balances())[ACCOUNT.GATEWAY_BALANCE]).toBe(34500);
      expect((await gatewayCheck()).ok).toBe(true);
      await expect(payouts().reverse(String(payout._id), 'again', undefined)).rejects.toThrow(ConflictException);
      await reconciled();
    });
  });

  describe('webhook', () => {
    const modules = PLAN_MODULES[StorePlan.FULL].concat(StoreModule.ONLINE_PAYMENTS);
    let event: WebhookEvent;
    const provider = { id: 'paymob', parseWebhook: () => event };
    const gateway = { forWebhook: async () => ({ provider, credentials: {} }) };
    const mailer = { paymentReceived: jest.fn(), paymentRefunded: jest.fn() };
    const service = () =>
      new OnlinePaymentsService(
        db.model('Order') as never,
        db.model('PaymentAttempt') as never,
        db.model('Customer') as never,
        db.model('Payment') as never,
        db,
        modules,
        gateway as never,
        store.payments,
        mailer as never,
        'shop.test',
        db.model('Setting') as never,
      );
    beforeEach(() => {
      mailer.paymentReceived.mockReset();
      mailer.paymentRefunded.mockReset();
    });
    const attempt = async (orderId: string, amountMinor = 34500) =>
      db.model('PaymentAttempt').create({ order: orderId, provider: 'paymob', reference: `ref-${orderId}`, amountMinor, currencyCode: 'EGP' }) as Promise<any>;
    const paid = (orderId: string, over: { amountMinor?: number; currencyCode?: string; transactionId?: string } = {}): WebhookEvent => ({
      kind: 'paid', reference: `ref-${orderId}`, transactionId: 'tx-9', amountMinor: 34500, currencyCode: 'EGP', ...over,
    });
    const send = () => service().handleWebhook('paymob', { body: {}, query: {}, headers: {} });

    it('books a verified payment once, however often the gateway repeats it', async () => {
      const id = await onlineOrder();
      await attempt(id);
      event = paid(id);

      await send();
      await send();
      await send();

      expect(await db.model('Payment').countDocuments({ order: id })).toBe(1);
      expect(await db.model('PaymentAttempt').findOne({ order: id }).lean()).toMatchObject({ status: AttemptStatus.SUCCEEDED, providerTransactionId: 'tx-9' });
      expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID });
      await reconciled();
    });

    describe('a late or lost notice', () => {
      const sync = async (orderId: string, inquiry: WebhookEvent) => {
        (provider as any).inquire = async () => inquiry;
        await service().syncOrder(await db.model('Order').findById(orderId).exec() as never);
        delete (provider as any).inquire;
      };

      it('settles the order when the gateway says it was paid, once, and agrees with a notice that arrives later', async () => {
        const id = await onlineOrder();
        await attempt(id);

        await sync(id, paid(id));
        await sync(id, paid(id));
        expect(await db.model('Payment').countDocuments({ order: id })).toBe(1);
        expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID });

        event = paid(id);
        await send();
        expect(await db.model('Payment').countDocuments({ order: id })).toBe(1);
        await reconciled();
      });

      it('does nothing while the gateway knows nothing yet', async () => {
        const id = await onlineOrder();
        await attempt(id);
        await sync(id, { kind: 'ignored' });
        expect(await db.model('Payment').countDocuments({ order: id })).toBe(0);
      });

      it('does not mark an attempt failed on a gateway\'s say-so; the customer can pay again', async () => {
        const id = await onlineOrder();
        await attempt(id);
        await sync(id, { kind: 'failed', reference: `ref-${id}`, transactionId: 'tx-0', amountMinor: 34500, currencyCode: 'EGP' });
        expect(await db.model('PaymentAttempt').findOne({ order: id }).lean()).toMatchObject({ status: AttemptStatus.PENDING });
      });

      it('leaves a cancelled order alone', async () => {
        const id = await onlineOrder();
        await attempt(id);
        await store.orders.updateStatus(id, OrderStatus.CANCELLED, undefined, undefined, 'shop.test');
        await sync(id, paid(id));
        expect(await db.model('Payment').countDocuments({ order: id })).toBe(0);
      });
    });

    it('tells the customer once the payment is booked, however often the notice repeats, and never for one that books nothing', async () => {
      const id = await onlineOrder();
      await attempt(id);
      event = paid(id);
      await send();
      await send();
      expect(mailer.paymentReceived).toHaveBeenCalledTimes(1);
      expect(mailer.paymentReceived.mock.calls[0][2]).toBe(34500);

      mailer.paymentReceived.mockReset();
      const other = await onlineOrder();
      await attempt(other);
      event = paid(other, { amountMinor: 100 });
      await send();
      expect(mailer.paymentReceived).not.toHaveBeenCalled();
    });

    it('books nothing and flags it when the amount is not what was asked', async () => {
      const id = await onlineOrder();
      await attempt(id);
      event = paid(id, { amountMinor: 100 });

      await send();

      expect(await db.model('Payment').countDocuments({ order: id })).toBe(0);
      expect(await db.model('PaymentAttempt').findOne({ order: id }).lean()).toMatchObject({ status: AttemptStatus.NEEDS_REVIEW });
    });

    it('books nothing and flags it when the order was cancelled before the money arrived', async () => {
      const id = await onlineOrder();
      await attempt(id);
      await store.orders.updateStatus(id, OrderStatus.CANCELLED, undefined, undefined, 'shop.test');
      event = paid(id);

      await send();

      expect(await db.model('Payment').countDocuments({ order: id })).toBe(0);
      expect(await db.model('PaymentAttempt').findOne({ order: id }).lean()).toMatchObject({ status: AttemptStatus.NEEDS_REVIEW });
    });

    it('marks a declined attempt failed and leaves the order unpaid', async () => {
      const id = await onlineOrder();
      await attempt(id);
      event = { kind: 'failed', reference: `ref-${id}`, transactionId: 'tx-bad', amountMinor: 34500, currencyCode: 'EGP' };

      await send();

      expect(await db.model('PaymentAttempt').findOne({ order: id }).lean()).toMatchObject({ status: AttemptStatus.FAILED });
      expect(await order(id)).toMatchObject({ paymentStatus: OrderPaymentStatus.UNPAID });
    });

    it('ignores a notice for a reference it never issued', async () => {
      event = { kind: 'paid', reference: 'nobody', transactionId: 'x', amountMinor: 1, currencyCode: 'EGP' };
      await expect(send()).resolves.toBeUndefined();
    });
  });

  describe('cancelling a paid order', () => {
    const modules = PLAN_MODULES[StorePlan.FULL].concat(StoreModule.ONLINE_PAYMENTS);
    const refund = jest.fn() as jest.Mock;
    const provider = { id: 'paymob', refund, parseWebhook: jest.fn() as jest.Mock };
    const gateway = { forWebhook: async () => ({ provider, credentials: {} }) };
    let online: OnlinePaymentsService;
    const mailer = { paymentReceived: jest.fn(), paymentRefunded: jest.fn() };

    beforeEach(() => {
      refund.mockReset().mockResolvedValue(undefined);
      mailer.paymentReceived.mockReset();
      mailer.paymentRefunded.mockReset();
      online = new OnlinePaymentsService(
        db.model('Order') as never,
        db.model('PaymentAttempt') as never,
        db.model('Customer') as never,
        db.model('Payment') as never,
        db,
        modules,
        gateway as never,
        store.payments,
        mailer as never,
        'shop.test',
        db.model('Setting') as never,
      );
      // Cancelling asks this service to send the money back.
      (store.orders as any).onlinePayments = online;
    });

    const cancel = (id: string) => store.orders.updateStatus(id, OrderStatus.CANCELLED, 'changed my mind', undefined, 'shop.test');
    const paymentOf = (id: string) => db.model('Payment').findOne({ order: id }).lean().exec() as Promise<any>;

    it('tells the customer when the money is on its way back, and says nothing if the gateway failed', async () => {
      const id = await onlineOrder();
      await pay(id, 34500, 'tx-77');
      refund.mockRejectedValueOnce(new Error('down'));
      await cancel(id);
      expect(mailer.paymentRefunded).not.toHaveBeenCalled();

      await online.refundPayment((await paymentOf(id))._id);
      expect(mailer.paymentRefunded).toHaveBeenCalledTimes(1);
      expect(mailer.paymentRefunded.mock.calls[0][2]).toBe(34500);
    });

    it('sends the money back through the gateway and lets the books go of it', async () => {
      const id = await onlineOrder();
      await pay(id, 34500, 'tx-77');

      await cancel(id);

      expect(refund).toHaveBeenCalledWith({}, { transactionId: 'tx-77', amountMinor: 34500 });
      expect(await order(id)).toMatchObject({
        status: OrderStatus.CANCELLED,
        paymentStatus: OrderPaymentStatus.REFUNDED,
        money: { collectedMinor: 0, depositMinor: 0, refundedMinor: 34500 },
      });
      expect(await paymentOf(id)).toMatchObject({ refundState: GatewayRefundState.DONE, heldAsDeposit: false });
      // Nothing is held for the customer any more, and the gateway balance is back to zero.
      expect(await balances()).toMatchObject({ [ACCOUNT.GATEWAY_BALANCE]: 0, [ACCOUNT.CUSTOMER_DEPOSITS]: 0 });
      await reconciled();
    });

    it('keeps the cancellation and the customer\'s deposit when the gateway cannot refund, and retries', async () => {
      const id = await onlineOrder();
      await pay(id, 34500, 'tx-78');
      refund.mockRejectedValueOnce(new Error('Paymob is down'));

      await cancel(id);

      expect(await order(id)).toMatchObject({ status: OrderStatus.CANCELLED, money: { collectedMinor: 34500, depositMinor: 34500 } });
      expect(await paymentOf(id)).toMatchObject({ refundState: GatewayRefundState.FAILED, refundNote: 'Paymob is down' });
      // Still the customer's money in the books until it really went back.
      expect(await balances()).toMatchObject({ [ACCOUNT.GATEWAY_BALANCE]: 34500, [ACCOUNT.CUSTOMER_DEPOSITS]: 34500 });

      await online.refundPayment((await paymentOf(id))._id);

      expect(refund).toHaveBeenCalledTimes(2);
      expect(await paymentOf(id)).toMatchObject({ refundState: GatewayRefundState.DONE });
      expect(await balances()).toMatchObject({ [ACCOUNT.GATEWAY_BALANCE]: 0, [ACCOUNT.CUSTOMER_DEPOSITS]: 0 });
      await reconciled();
    });

    describe('a refund stuck in progress', () => {
      /** The server stopped after asking the gateway: the payment is left "processing". */
      const stuck = async () => {
        const id = await onlineOrder();
        await pay(id, 34500, 'tx-80');
        refund.mockRejectedValueOnce(new Error('down'));
        await cancel(id);
        await db.model('Payment').updateOne({ order: id }, { $set: { refundState: GatewayRefundState.PROCESSING }, $unset: { refundNote: 1 } });
        return id;
      };

      it('is settled as sent: the books let go of the money and the customer is told, once', async () => {
        const id = await stuck();
        await expect(online.refundPayment((await paymentOf(id))._id)).rejects.toThrow(ConflictException);

        await online.resolveStuckPayment((await paymentOf(id))._id, 'sent');

        expect(await paymentOf(id)).toMatchObject({ refundState: GatewayRefundState.DONE, heldAsDeposit: false });
        expect(await balances()).toMatchObject({ [ACCOUNT.GATEWAY_BALANCE]: 0, [ACCOUNT.CUSTOMER_DEPOSITS]: 0 });
        expect(mailer.paymentRefunded).toHaveBeenCalledTimes(1);
        await expect(online.resolveStuckPayment((await paymentOf(id))._id, 'sent')).rejects.toThrow(ConflictException);
        await reconciled();
      });

      it('is settled as not sent: it fails with the reason, and can be sent again', async () => {
        const id = await stuck();

        await online.resolveStuckPayment((await paymentOf(id))._id, 'not_sent', 'not in the dashboard');

        expect(await paymentOf(id)).toMatchObject({ refundState: GatewayRefundState.FAILED });
        expect((await paymentOf(id)).refundNote).toContain('not in the dashboard');
        expect(mailer.paymentRefunded).not.toHaveBeenCalled();
        expect(await balances()).toMatchObject({ [ACCOUNT.CUSTOMER_DEPOSITS]: 34500 });

        await online.refundPayment((await paymentOf(id))._id);
        expect(await paymentOf(id)).toMatchObject({ refundState: GatewayRefundState.DONE });
        await reconciled();
      });

      it('only settles one that is actually in progress', async () => {
        const id = await onlineOrder();
        await pay(id, 34500, 'tx-81');
        await cancel(id);
        await expect(online.resolveStuckPayment((await paymentOf(id))._id, 'not_sent')).rejects.toThrow(ConflictException);
      });
    });

    it('never refunds the same payment twice', async () => {
      const id = await onlineOrder();
      await pay(id, 34500, 'tx-79');
      await cancel(id);
      const payment = await paymentOf(id);

      await expect(online.refundPayment(payment._id)).rejects.toThrow(ConflictException);
      expect(refund).toHaveBeenCalledTimes(1);
    });

    it('does not touch the gateway for an order nobody paid', async () => {
      const id = await onlineOrder();
      await cancel(id);
      expect(refund).not.toHaveBeenCalled();
    });

    it('sends back money that reaches an order cancelled in the meantime', async () => {
      const id = await onlineOrder();
      await db.model('PaymentAttempt').create({ order: id, provider: 'paymob', reference: 'late-ref', amountMinor: 34500, currencyCode: 'EGP' });
      await cancel(id);
      provider.parseWebhook.mockReturnValue({ kind: 'paid', reference: 'late-ref', transactionId: 'tx-late', amountMinor: 34500, currencyCode: 'EGP' });

      await online.handleWebhook('paymob', { body: {}, query: {}, headers: {} });

      expect(refund).toHaveBeenCalledWith({}, { transactionId: 'tx-late', amountMinor: 34500 });
      expect(await db.model('PaymentAttempt').findOne({ reference: 'late-ref' }).lean()).toMatchObject({ status: AttemptStatus.REFUNDED });
      expect(await db.model('Payment').countDocuments({ order: id })).toBe(0);
    });
  });
});
