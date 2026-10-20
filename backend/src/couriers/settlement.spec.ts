import { BadRequestException, ConflictException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { OrderPaymentStatus, OrderStatus } from '../orders/enums/order-status.enum';
import { Custody } from '../finance/schemas/payment.schema';
import { ACCOUNT } from '../finance/accounts';
import { RefundMethod, RefundReason } from '../refunds/schemas/refund.schema';

jest.setTimeout(180_000);

/**
 * Step 5: couriers hand over the cash they hold, expenses are recorded, and
 * what will never be paid is written off. Expected values are examples E5,
 * E6, E9 and the combined month E10 of the specification, to the piastre.
 */
describe('Couriers, expenses and write-offs', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let store: Store;
  let courierId: string;

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
    courierId = String((await store.couriers.create({ name: 'Hany' }))._id);
  });

  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };

  /** E5's order: 4 × D at 115.00 (cost 75.00), delivery 40.00 — 500.00, delivered, 450.00 collected by the courier. */
  const e5 = async () => {
    store.delivery.price = 40;
    const d = await store.product(115, 10, 75);
    const order = await store.place(await store.customer(), [{ productId: d, quantity: 4 }]);
    await store.advance(String(order._id));
    await store.payments.recordCollection(String(order._id), { amount: '450', custody: Custody.COURIER, courierId });
    return String(order._id);
  };

  it('E5 — the courier hands over 450.00 less a 25.00 fee; 50.00 stays a receivable', async () => {
    await e5();
    expect((await store.couriers.detail(courierId)).heldMinor).toBe(45000);

    const settlement = await store.couriers.settle({ courierId, fees: '25', received: '425' });
    expect(settlement).toMatchObject({ collectedMinor: 45000, feesMinor: 2500, expectedMinor: 42500, receivedMinor: 42500, differenceMinor: 0 });
    expect(await store.journal.balances()).toMatchObject({
      [ACCOUNT.COURIER_CASH]: 0,
      [ACCOUNT.CASH]: 42500,
      [ACCOUNT.DELIVERY_COSTS]: 2500,
      [ACCOUNT.RECEIVABLES]: 5000,
    });
    expect((await store.couriers.detail(courierId)).heldMinor).toBe(0);
    await expect(store.couriers.settle({ courierId, received: '0' })).rejects.toThrow('holds nothing');
    await reconciled();
  });

  it('E9 — a short settlement needs a reason and goes to cash over/short', async () => {
    await e5();
    await expect(store.couriers.settle({ courierId, fees: '25', received: '420' })).rejects.toThrow('5.00 short');
    const settlement = await store.couriers.settle({ courierId, fees: '25', received: '420', differenceReason: 'Courier lost change' });
    expect(settlement.differenceMinor).toBe(-500);
    expect((await store.journal.balances())[ACCOUNT.CASH_OVER_SHORT]).toBe(500);
    await reconciled();
  });

  it('E9 — writing off what the customer will never pay', async () => {
    const orderId = await e5();
    await expect(store.payments.writeOff(orderId, '60', 'gone')).rejects.toThrow('Only 50.00 is still owed');
    const order = await store.payments.writeOff(orderId, undefined, 'Customer unreachable');
    expect(order).toMatchObject({ paymentStatus: OrderPaymentStatus.WRITTEN_OFF, money: { writtenOffMinor: 5000 } });
    expect(await store.journal.balances()).toMatchObject({ [ACCOUNT.RECEIVABLES]: 0, [ACCOUNT.UNCOLLECTIBLE]: 5000 });
    await expect(store.payments.recordCollection(orderId, { amount: '1', custody: Custody.STORE })).rejects.toThrow('Only 0.00');
    await reconciled();
  });

  it('a refund the courier pays comes off what they hand over', async () => {
    const orderId = await e5();
    const refund = await store.refunds.request(
      { orderId, lines: [{ lineIndex: 0, quantity: 1 }], reason: RefundReason.WRONG_ITEM, method: RefundMethod.COURIER_CASH, courierId },
      undefined,
    );
    await store.refunds.execute(String(refund._id), undefined, 'shop.test');
    expect((await store.couriers.detail(courierId)).heldMinor).toBe(45000 - 11500);

    await store.couriers.settle({ courierId, received: '335' });
    // Settled cash is history: neither the collection nor the refund can be undone now.
    const [payment] = await db.model('Payment').find().lean<any[]>();
    await expect(store.payments.voidCollection(String(payment._id), 'mistake')).rejects.toBeInstanceOf(ConflictException);
    await expect(store.refunds.reverse(String(refund._id), 'mistake', undefined)).rejects.toBeInstanceOf(ConflictException);
    await reconciled();
  });

  it('a courier collection must name its courier', async () => {
    store.delivery.price = 0;
    const order = await store.place(await store.customer(), [{ productId: await store.product(10), quantity: 1 }]);
    await store.advance(String(order._id));
    await expect(store.payments.recordCollection(String(order._id), { amount: '10', custody: Custody.COURIER })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('expenses: recorded from cash, reversed with a mirror entry, totalled by category', async () => {
    const rent = await store.expenses.create({ account: ACCOUNT.RENT, amount: '3000', description: 'October rent' });
    await store.expenses.create({ account: ACCOUNT.MARKETING, amount: '250.50', description: 'Ads' });
    await expect(store.expenses.create({ account: ACCOUNT.RENT, amount: '0', description: 'x' })).rejects.toBeInstanceOf(BadRequestException);

    await store.expenses.reverse(String(rent._id), 'Paid twice by mistake');
    const list = await store.expenses.list({});
    expect(list.totalsByAccount).toEqual({ [ACCOUNT.MARKETING]: 25050 });
    expect((await store.journal.balances())[ACCOUNT.RENT]).toBe(0);
    await expect(store.expenses.reverse(String(rent._id), 'again')).rejects.toBeInstanceOf(ConflictException);
    await reconciled();
  });

  it('E10 — the combined month reconciles to the piastre', async () => {
    // E1: 2 × A at 150.00 (cost 90.00), 10% off, delivery 45.00, paid in cash.
    store.delivery.price = 45;
    const a = await store.product(150, 10, 90);
    await store.coupon({ code: 'TEN', value: 10 });
    const e1 = await store.place(await store.customer(), [{ productId: a, quantity: 2 }], 'TEN');
    await store.advance(String(e1._id));
    await store.payments.recordCollection(String(e1._id), { amount: '315', custody: Custody.STORE });

    // E5: courier collects 450.00 of 500.00 and settles with a 25.00 fee.
    await e5();
    await store.couriers.settle({ courierId, fees: '25', received: '425' });

    // E6: shipped, refused at the door, cancelled; the courier charged 20.00 for the attempt.
    store.delivery.price = 30;
    const e6 = await store.place(await store.customer(), [{ productId: await store.product(100, 5, 60), quantity: 1 }]);
    await store.advance(String(e6._id), OrderStatus.SHIPPED);
    await store.orders.updateStatus(String(e6._id), OrderStatus.CANCELLED, 'refused', undefined, 'shop.test');
    await store.expenses.create({ account: ACCOUNT.DELIVERY_COSTS, amount: '20', description: 'Failed delivery', orderId: String(e6._id), courierId });

    // Rent.
    await store.expenses.create({ account: ACCOUNT.RENT, amount: '3000', description: 'Rent' });

    expect(await store.finance.summary()).toMatchObject({
      grossProductSalesMinor: 76000,
      discountsMinor: 3000,
      netProductSalesMinor: 73000,
      deliveryIncomeMinor: 8500,
      netRevenueMinor: 81500,
      costOfSalesMinor: 48000,
      grossProfitMinor: 33500,
      deliveryCostsMinor: 4500,
      contributionMinor: 29000,
      operatingExpensesMinor: 300000,
      netProfitMinor: -271000,
      collectedMinor: 76500,
      netCashFlowMinor: -228000,
      receivablesMinor: 5000,
      courierCustodyMinor: 0,
      deliveredOrders: 2,
      averageOrderValueMinor: 40750,
      uncostedLines: 0,
    });
    await reconciled();
  });
});
