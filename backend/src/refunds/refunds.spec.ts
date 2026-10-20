import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { OrderPaymentStatus } from '../orders/enums/order-status.enum';
import { Custody } from '../finance/schemas/payment.schema';
import { ACCOUNT } from '../finance/accounts';
import { RefundMethod, RefundReason, RefundStatus } from './schemas/refund.schema';
import { ReturnReason, ReturnStatus } from '../returns/schemas/return-request.schema';
import { DeliveryFeeRefundPolicy } from '../settings/schemas/setting.schema';

jest.setTimeout(180_000);

/**
 * Step 3: refunds are their own records with caps, approvals and a
 * delivery-fee policy, and report in the period they are paid. Expected
 * values are examples E4 and E7 of the specification, to the piastre.
 */
describe('Refunds', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let store: Store;
  const alice = String(new Types.ObjectId());
  const bob = String(new Types.ObjectId());

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
    store = buildStore(db);
    store.delivery.price = 45;
  });

  const order = (id: unknown) => db.model('Order').findById(id).lean<any>().exec();
  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };

  /** E1's order: 2 × A at 150.00, 10% off, 45.00 delivery — 315.00, delivered and paid in cash. */
  const e1 = async (collect = true) => {
    const a = await store.product(150, 10);
    await store.coupon({ code: 'TEN', value: 10 });
    const placed = await store.place(await store.customer(), [{ productId: a, quantity: 2 }], 'TEN');
    await store.advance(String(placed._id));
    if (collect) await store.payments.recordCollection(String(placed._id), { amount: '315.00', custody: Custody.STORE });
    return { orderId: String(placed._id), productId: a };
  };

  /** A plain order of one item at `price`, no delivery fee, delivered and fully collected. */
  const paidOrder = async (price: number) => {
    store.delivery.price = 0;
    const placed = await store.place(await store.customer(), [{ productId: await store.product(price), quantity: 1 }]);
    await store.advance(String(placed._id));
    await store.payments.recordCollection(String(placed._id), { amount: String(price), custody: Custody.STORE });
    return String(placed._id);
  };

  describe('E4 — partial return a month later', () => {
    it('refunds one unit at its share of what was paid, in its own period, and restocks it', async () => {
      const { orderId, productId } = await e1();
      // The sale happened in September: move its entry and delivery there.
      const sale = new Date('2026-09-15T10:00:00Z');
      await db.model('JournalEntry').updateMany({ 'source.type': 'order' }, { $set: { date: sale } });
      await db.model('Order').updateOne({ _id: orderId }, { $set: { bookedAt: sale, deliveredAt: sale } });

      const preview = await store.refunds.preview({ orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND });
      expect(preview).toMatchObject({ productSuggestedMinor: 13500, deliverySuggestedMinor: 0, fullReturn: false });

      const refund = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1, restock: true }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
        alice,
      );
      expect(refund).toMatchObject({ productMinor: 13500, deliveryMinor: 0, totalMinor: 13500, status: RefundStatus.APPROVED, autoApproved: true });
      expect(refund.refundNumber).toBe(3001);

      await store.refunds.execute(String(refund._id), alice, 'shop.test');
      const entry = await db.model('JournalEntry').findOne({ 'source.type': 'refund' }).lean<any>();
      expect(entry.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account: ACCOUNT.SALES_RETURNS, debitMinor: 13500 }),
          expect.objectContaining({ account: ACCOUNT.CASH, creditMinor: 13500 }),
        ]),
      );
      expect((await db.model('Product').findById(productId).lean<any>()).stock).toBe(9); // 10 − 2 sold + 1 back
      expect(await order(orderId)).toMatchObject({
        refundedTotal: 135,
        paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED,
        money: { refundedMinor: 13500, cashRefundedMinor: 13500, deliveryRefundedMinor: 0 },
      });

      // September keeps its sale untouched; the refund reports today.
      expect(await store.finance.summary('2026-09-01', '2026-09-30')).toMatchObject({ netRevenueMinor: 31500, productReturnsMinor: 0 });
      const today = await store.finance.summary();
      expect(today).toMatchObject({ productReturnsMinor: 13500, refundsPaidOutMinor: 13500 });
      expect((await store.finance.summary(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))).netRevenueMinor).toBe(-13500);
      await reconciled();
    });

    it('refuses more than is left on the line', async () => {
      const { orderId } = await e1();
      const first = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
        alice,
      );
      await store.refunds.execute(String(first._id), alice, 'shop.test');
      await expect(
        store.refunds.request(
          { orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND, productAmount: '150.00', method: RefundMethod.CASH },
          alice,
        ),
      ).rejects.toThrow('at most 135.00');
    });

    it('gives the delivery fee back when the second, damaged unit completes the return', async () => {
      const { orderId } = await e1();
      const first = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1, restock: true }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
        alice,
      );
      await store.refunds.execute(String(first._id), alice, 'shop.test');

      const second = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1, restock: false }], reason: RefundReason.DAMAGED, method: RefundMethod.CASH },
        alice,
      );
      expect(second).toMatchObject({ productMinor: 13500, deliveryMinor: 4500, totalMinor: 18000, status: RefundStatus.APPROVED });
      await store.refunds.execute(String(second._id), alice, 'shop.test');

      expect(await order(orderId)).toMatchObject({ paymentStatus: OrderPaymentStatus.REFUNDED, money: { refundedMinor: 31500, deliveryRefundedMinor: 4500 } });
      expect(await store.finance.summary()).toMatchObject({ productReturnsMinor: 27000, deliveryIncomeMinor: 0, netRevenueMinor: 0 });
      await reconciled();
    });
  });

  describe('E7 — thresholds and who may approve', () => {
    it('needs an approver for anything over the automatic limit, and a second person past the single-approver limit', async () => {
      const small = await paidOrder(1500);
      const big = await paidOrder(2500);
      const ask = (orderId: string) =>
        store.refunds.request({ orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.WRONG_ITEM, method: RefundMethod.CASH }, alice);

      const r1500 = await ask(small);
      expect(r1500.status).toBe(RefundStatus.REQUESTED);
      await expect(store.refunds.execute(String(r1500._id), alice, 'shop.test')).rejects.toThrow('must be approved');
      await expect(store.refunds.approve(String(r1500._id), alice)).resolves.toMatchObject({ status: RefundStatus.APPROVED });

      const r2500 = await ask(big);
      await expect(store.refunds.approve(String(r2500._id), alice)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(store.refunds.approve(String(r2500._id), bob)).resolves.toMatchObject({ status: RefundStatus.APPROVED });
    });

    it('lets a store change its limits — only its super admin, with every change recorded', async () => {
      const owner = String((await db.model('User').create({ name: 'O', email: 'o@x', password: 'x', isSuper: true }))._id);
      const staff = String((await db.model('User').create({ name: 'S', email: 's@x', password: 'x' }))._id);
      await expect(store.refunds.updateRules({ autoApproveUpTo: '500' }, staff)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(store.refunds.updateRules({ autoApproveUpTo: '5000' }, owner)).rejects.toThrow('cannot be above');

      const rules = await store.refunds.updateRules({ autoApproveUpTo: '500.00', deliveryFeeRefund: DeliveryFeeRefundPolicy.NEVER }, owner);
      expect(rules).toMatchObject({ autoApproveUpToMinor: 50000, singleApproverUpToMinor: 200000, deliveryFeeRefund: 'never' });
      expect(rules.history.map((h: any) => [h.field, h.from, h.to])).toEqual([
        ['autoApproveUpToMinor', 20000, 50000],
        ['deliveryFeeRefund', 'store_fault_full_return', 'never'],
      ]);
    });
  });

  describe('caps', () => {
    it('two payouts racing for the same balance: only one lands', async () => {
      const orderId = await paidOrder(150);
      const first = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 0 }], reason: RefundReason.GOODWILL, productAmount: '100', method: RefundMethod.CASH },
        alice,
      );
      // A second approved refund that slipped past the request check (two requests racing).
      const twin = await db.model('Refund').create({ ...first.toObject(), _id: new Types.ObjectId(), refundNumber: 9999 });

      const results = await Promise.allSettled([
        store.refunds.execute(String(first._id), alice, 'shop.test'),
        store.refunds.execute(String(twin._id), alice, 'shop.test'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
      expect((await order(orderId)).money.refundedMinor).toBe(10000);
      await reconciled();
    });

    it('pays back cash only up to what was collected; the rest goes as a credit against what is owed', async () => {
      const { orderId } = await e1(false); // delivered, nothing collected
      const ask = (method: RefundMethod) =>
        store.refunds.request({ orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND, method }, alice);

      await expect(ask(RefundMethod.CASH)).rejects.toThrow(/was collected/);
      const credit = await ask(RefundMethod.CREDIT_AGAINST_RECEIVABLE);
      await store.refunds.execute(String(credit._id), alice, 'shop.test');

      expect(await store.finance.summary()).toMatchObject({ receivablesMinor: 18000, refundsCreditedMinor: 13500, refundsPaidOutMinor: 0 });
      // The customer now owes 180.00, and paying exactly that settles the order.
      await expect(store.payments.recordCollection(orderId, { amount: '180.01', custody: Custody.STORE })).rejects.toThrow('180.00');
      await store.payments.recordCollection(orderId, { amount: '180', custody: Custody.STORE });
      // Collecting the rest must not forget the refund (a copied subdocument once did).
      expect((await order(orderId)).paymentStatus).toBe(OrderPaymentStatus.PARTIALLY_REFUNDED);
      await reconciled();
    });

    it('needs a note, and a person, to give back delivery beyond the policy', async () => {
      const { orderId } = await e1();
      const base = { orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND, deliveryAmount: '45', method: RefundMethod.CASH };
      await expect(store.refunds.request(base, alice)).rejects.toThrow(/needs a note/);
      const refund = await store.refunds.request({ ...base, note: 'Courier was two days late' }, alice);
      expect(refund).toMatchObject({ totalMinor: 18000, beyondPolicy: true, status: RefundStatus.REQUESTED, autoApproved: false });
    });

    it('refuses an order delivered before the books started', async () => {
      const { orderId } = await e1();
      await db.model('Order').updateOne({ _id: orderId }, { $unset: { bookedAt: 1 } });
      await expect(
        store.refunds.request({ orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.OTHER, method: RefundMethod.CASH }, alice),
      ).rejects.toThrow(/before the books started/);
    });

    it("won't void a collection that cash was already refunded from", async () => {
      const { orderId } = await e1();
      const refund = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
        alice,
      );
      await store.refunds.execute(String(refund._id), alice, 'shop.test');
      const [payment] = await db.model('Payment').find().lean<any[]>();
      await expect(store.payments.voidCollection(String(payment._id), 'mistake')).rejects.toThrow(/reverse that refund/);
    });
  });

  describe('returns and reversals', () => {
    const openReturn = async (orderId: string, productId: string) =>
      // Ids as the returns service writes them: ObjectIds. (The return schema
      // declares them in a way Mongoose doesn't cast, so a string would stay one.)
      db.model('ReturnRequest').create({
        returnNumber: 2001,
        order: new Types.ObjectId(orderId),
        orderNumber: (await order(orderId)).orderNumber,
        customer: (await order(orderId)).customer,
        items: [{ lineIndex: 0, product: new Types.ObjectId(productId), name: { en: 'A' }, unitPrice: 150, quantity: 2 }],
        reason: ReturnReason.DAMAGED,
        status: ReturnStatus.APPROVED,
        openedBy: 'store',
      });

    it("settles a return: its lines by default, and the return marked refunded", async () => {
      const { orderId, productId } = await e1();
      const ret = await openReturn(orderId, productId);

      const refund = await store.refunds.request({ orderId, returnId: String(ret._id), reason: RefundReason.DAMAGED, method: RefundMethod.CASH }, bob);
      expect(refund).toMatchObject({ productMinor: 27000, deliveryMinor: 4500, totalMinor: 31500, status: RefundStatus.REQUESTED });
      expect(refund.lines[0]).toMatchObject({ quantity: 2, restock: false }); // damaged goods stay off the shelf
      await store.refunds.approve(String(refund._id), alice);
      await store.refunds.execute(String(refund._id), bob, 'shop.test');

      expect(await db.model('ReturnRequest').findById(ret._id).lean<any>()).toMatchObject({ status: ReturnStatus.REFUNDED, refundAmount: 315 });
      await expect(
        store.refunds.request({ orderId, returnId: String(ret._id), reason: RefundReason.DAMAGED, method: RefundMethod.CASH }, bob),
      ).rejects.toThrow(/can't be refunded|already has a refund/);
      await reconciled();
    });

    it('reverses a mistaken refund with a mirror entry, and reopens its return', async () => {
      const { orderId, productId } = await e1();
      const ret = await openReturn(orderId, productId);
      const refund = await store.refunds.request(
        { orderId, returnId: String(ret._id), lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
        alice,
      );
      await store.refunds.execute(String(refund._id), alice, 'shop.test');
      await store.refunds.reverse(String(refund._id), 'refunded the wrong order', alice);

      const entries = await db.model('JournalEntry').find({ 'source.type': 'refund' }).sort({ entryNumber: 1 }).lean<any[]>();
      expect(entries.map((e) => e.source.event)).toEqual(['executed', 'reversed']);
      expect(entries[1].reversalOf).toEqual(entries[0]._id);
      expect(await order(orderId)).toMatchObject({ paymentStatus: OrderPaymentStatus.PAID, money: { refundedMinor: 0 } });
      expect((await db.model('ReturnRequest').findById(ret._id).lean<any>()).status).toBe(ReturnStatus.APPROVED);
      expect((await store.finance.summary()).productReturnsMinor).toBe(0);
      await expect(store.refunds.reverse(String(refund._id), 'again', alice)).rejects.toBeInstanceOf(ConflictException);
      await reconciled();
    });

    it('refuses to reject or approve a refund that is already paid', async () => {
      const orderId = await paidOrder(100);
      const refund = await store.refunds.request(
        { orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.OTHER, method: RefundMethod.CASH },
        alice,
      );
      await store.refunds.execute(String(refund._id), alice, 'shop.test');
      await expect(store.refunds.reject(String(refund._id), bob)).rejects.toBeInstanceOf(ConflictException);
      await expect(store.refunds.approve(String(refund._id), bob)).rejects.toBeInstanceOf(ConflictException);
      await expect(
        store.refunds.request({ orderId, lines: [], reason: RefundReason.OTHER, productAmount: '0', method: RefundMethod.CASH }, alice),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
