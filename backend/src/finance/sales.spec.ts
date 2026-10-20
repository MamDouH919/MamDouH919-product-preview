import { BadRequestException, ConflictException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { OrderPaymentStatus, OrderStatus } from '../orders/enums/order-status.enum';
import { Custody } from './schemas/payment.schema';
import { ACCOUNT } from './accounts';
import { zonedDayRange } from '../common/helpers/time-zone';

jest.setTimeout(180_000);

/**
 * Step 2 of the finance plan: sales are recognised on delivery, collections
 * are recorded apart from it, and every figure reconciles. Expected values
 * are the worked examples of the specification (section 15), computed by
 * hand there and asserted here to the piastre.
 */
describe('Sales and collections', () => {
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
    store = buildStore(db);
    store.delivery.price = 45;
  });

  /** The entries business events posted — leaving out the opening stock value a test set up. */
  const entries = () =>
    db.model('JournalEntry').find({ 'source.event': { $ne: 'opening_cost' } }).sort({ entryNumber: 1 }).lean().exec() as Promise<any[]>;
  const reconciled = async () => {
    const report = await store.reconciliation.run();
    const broken = report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`);
    expect(broken).toEqual([]);
  };

  describe('E1 — delivered COD order', () => {
    it('books nothing at checkout, the sale on delivery, and the cash on collection', async () => {
      const a = await store.product(150, 10, 90); // 10 bought at 90.00 — stock worth 900.00
      const customer = await store.customer();
      await store.coupon({ code: 'TEN', value: 10 });

      const placed = await store.place(customer, [{ productId: a, quantity: 2 }], 'TEN');
      expect(placed).toMatchObject({
        subtotalMinor: 30000,
        discountMinor: 3000,
        shippingFeeMinor: 4500,
        totalMinor: 31500,
        total: 315,
        paymentStatus: OrderPaymentStatus.UNPAID,
      });
      // Pending is not a sale — but its goods are set aside at cost.
      const [reserved] = await entries();
      expect(reserved.source.event).toBe('reserved');
      expect(reserved.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account: ACCOUNT.GOODS_AWAITING_DELIVERY, debitMinor: 18000 }),
          expect.objectContaining({ account: ACCOUNT.INVENTORY, creditMinor: 18000 }),
        ]),
      );
      expect((await db.model('Order').findById(placed._id).lean<any>()).items[0].costMinor).toBe(18000);

      const delivered = await store.advance(String(placed._id));
      expect(delivered.bookedAt).toBeDefined();
      const [, sale] = await entries();
      const side = (account: string) => sale.lines.find((l: any) => l.account === account);
      expect(side(ACCOUNT.RECEIVABLES).debitMinor).toBe(31500);
      expect(side(ACCOUNT.SALES_DISCOUNTS).debitMinor).toBe(3000);
      expect(side(ACCOUNT.PRODUCT_SALES).creditMinor).toBe(30000);
      expect(side(ACCOUNT.DELIVERY_INCOME).creditMinor).toBe(4500);
      expect(side(ACCOUNT.COGS).debitMinor).toBe(18000);
      expect(side(ACCOUNT.GOODS_AWAITING_DELIVERY).creditMinor).toBe(18000);

      const beforeCash = await store.finance.summary();
      expect(beforeCash).toMatchObject({
        grossProductSalesMinor: 30000,
        discountsMinor: 3000,
        netProductSalesMinor: 27000,
        deliveryIncomeMinor: 4500,
        netRevenueMinor: 31500,
        receivablesMinor: 31500,
        collectedMinor: 0,
        deliveredOrders: 1,
        averageOrderValueMinor: 31500,
        costOfSalesMinor: 18000,
        grossProfitMinor: 13500,
        uncostedLines: 0,
      });

      await store.payments.recordCollection(String(placed._id), { amount: '315.00', custody: Custody.STORE });
      const after = await store.finance.summary();
      expect(after).toMatchObject({ receivablesMinor: 0, collectedMinor: 31500, cashReceivedByStoreMinor: 31500, netRevenueMinor: 31500 });
      expect((await db.model('Order').findById(placed._id).lean<any>()).paymentStatus).toBe(OrderPaymentStatus.PAID);
      await reconciled();
    });
  });

  it('E3 — splits a 15% discount so the line shares add up exactly', async () => {
    store.delivery.price = 30;
    const x = await store.product(33.33);
    const y = await store.product(10);
    await store.coupon({ code: 'FIFTEEN', value: 15 });
    const order: any = await store.place(await store.customer(), [
      { productId: x, quantity: 3 },
      { productId: y, quantity: 1 },
    ], 'FIFTEEN');

    expect(order.subtotalMinor).toBe(10999);
    expect(order.discountMinor).toBe(1650);
    expect(order.items.map((i: any) => i.discountMinor)).toEqual([1500, 150]);
    expect(order.totalMinor).toBe(12349);
    expect(order.total).toBe(123.49);
  });

  it('E5 — a courier collects less than is owed; the rest stays a receivable', async () => {
    store.delivery.price = 40;
    const d = await store.product(115);
    const order = await store.place(await store.customer(), [{ productId: d, quantity: 4 }]);
    await store.advance(String(order._id));

    const courierId = String((await store.couriers.create({ name: 'Hany' }))._id);
    await store.payments.recordCollection(String(order._id), { amount: '450', custody: Custody.COURIER, courierId });
    const summary = await store.finance.summary();
    expect(summary).toMatchObject({ netRevenueMinor: 50000, deliveryIncomeMinor: 4000, receivablesMinor: 5000, courierCustodyMinor: 45000, collectedMinor: 45000, cashReceivedByStoreMinor: 0 });
    expect((await db.model('Order').findById(order._id).lean<any>()).paymentStatus).toBe(OrderPaymentStatus.PARTIALLY_PAID);

    await expect(store.payments.recordCollection(String(order._id), { amount: '60', custody: Custody.COURIER, courierId })).rejects.toThrow(
      'Only 50.00 is still owed',
    );
    await reconciled();
  });

  it('E6 — a shipped order refused at the door books nothing and returns stock and coupon', async () => {
    const product = await store.product(100, 5);
    const coupon = await store.coupon({ code: 'ONCE', value: 10, usageLimit: 5 });
    const order = await store.place(await store.customer(), [{ productId: product, quantity: 2 }], 'ONCE');
    expect((await db.model('Product').findById(product).lean<any>()).stock).toBe(3);
    expect((await db.model('Coupon').findById(coupon._id).lean<any>()).usedCount).toBe(1);

    await store.advance(String(order._id), OrderStatus.SHIPPED);
    await store.orders.updateStatus(String(order._id), OrderStatus.CANCELLED, 'refused', undefined, 'shop.test');

    expect(await entries()).toHaveLength(0);
    expect((await db.model('Product').findById(product).lean<any>()).stock).toBe(5);
    expect((await db.model('Coupon').findById(coupon._id).lean<any>()).usedCount).toBe(0);
    expect((await store.finance.summary()).netRevenueMinor).toBe(0);
    await reconciled();
  });

  describe('races and failures leave nothing half-done', () => {
    it('two checkouts for the last unit: one order, no burnt number, one coupon use', async () => {
      const product = await store.product(50, 1);
      const coupon = await store.coupon({ code: 'RACE', value: 5, usageLimit: 10 });
      const [a, b] = [await store.customer(), await store.customer()];

      const results = await Promise.allSettled([
        store.place(a, [{ productId: product, quantity: 1 }], 'RACE'),
        store.place(b, [{ productId: product, quantity: 1 }], 'RACE'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(ConflictException);

      expect(await db.model('Order').countDocuments()).toBe(1);
      expect((await db.model('Counter').findOne({ name: 'order' }).lean<any>()).seq).toBe(1);
      expect((await db.model('Coupon').findById(coupon._id).lean<any>()).usedCount).toBe(1);
      expect((await db.model('Product').findById(product).lean<any>()).stock).toBe(0);
      expect(await db.model('StockMovement').countDocuments()).toBe(1);
    });

    it('a failure after the order is written rolls everything back', async () => {
      const product = await store.product(50, 3);
      const coupon = await store.coupon({ code: 'FAIL', value: 5 });
      jest.spyOn(store.inventory, 'adjustMany').mockRejectedValueOnce(new Error('disk full'));

      await expect(store.place(await store.customer(), [{ productId: product, quantity: 1 }], 'FAIL')).rejects.toThrow('disk full');
      expect(await db.model('Order').countDocuments()).toBe(0);
      expect(await db.model('Counter').countDocuments({ name: 'order' })).toBe(0);
      expect((await db.model('Coupon').findById(coupon._id).lean<any>()).usedCount).toBe(0);
    });

    it('one customer racing two checkouts for a once-per-customer coupon gets it once', async () => {
      const [p1, p2] = [await store.product(80), await store.product(90)];
      await store.coupon({ code: 'WELCOME', value: 10, perCustomerLimit: 1 });
      const customer = await store.customer();

      const results = await Promise.allSettled([
        store.place(customer, [{ productId: p1, quantity: 1 }], 'WELCOME'),
        store.place(customer, [{ productId: p2, quantity: 1 }], 'WELCOME'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.model('Order').countDocuments({ 'coupon.code': 'WELCOME' })).toBe(1);
      // And a third, later checkout is refused: the one use is spent.
      await expect(store.place(customer, [{ productId: p1, quantity: 1 }], 'WELCOME')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('two collections racing for the same balance: only one lands', async () => {
      store.delivery.price = 0;
      const order = await store.place(await store.customer(), [{ productId: await store.product(100), quantity: 1 }]);
      await store.advance(String(order._id));

      const results = await Promise.allSettled([
        store.payments.recordCollection(String(order._id), { amount: '100', custody: Custody.STORE }),
        store.payments.recordCollection(String(order._id), { amount: '100', custody: Custody.STORE }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await store.finance.summary()).collectedMinor).toBe(10000);
      await reconciled();
    });

    it('delivering twice is refused, so a sale is never booked twice', async () => {
      const order = await store.place(await store.customer(), [{ productId: await store.product(10), quantity: 1 }]);
      await store.advance(String(order._id));
      await expect(
        store.orders.updateStatus(String(order._id), OrderStatus.DELIVERED, undefined, undefined, 'shop.test'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await entries()).toHaveLength(1);
    });
  });

  describe('collections', () => {
    it('refuses cash for an order not yet delivered', async () => {
      const order = await store.place(await store.customer(), [{ productId: await store.product(10), quantity: 1 }]);
      await expect(store.payments.recordCollection(String(order._id), { amount: '10', custody: Custody.STORE })).rejects.toThrow(
        /mark the order delivered first/,
      );
    });

    it('refuses amounts that are zero, negative or past the piastre', async () => {
      const order = await store.place(await store.customer(), [{ productId: await store.product(10), quantity: 1 }]);
      await store.advance(String(order._id));
      for (const amount of ['0', '-5', '1.234']) {
        await expect(store.payments.recordCollection(String(order._id), { amount, custody: Custody.STORE })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
    });

    it('voiding reverses the entry instead of editing it, and the receivable comes back', async () => {
      const order = await store.place(await store.customer(), [{ productId: await store.product(100), quantity: 1 }]);
      await store.advance(String(order._id));
      const payment = await store.payments.recordCollection(String(order._id), { amount: '145', custody: Custody.STORE });

      await store.payments.voidCollection(String(payment._id), 'typed on the wrong order');
      const all = await entries();
      expect(all).toHaveLength(3); // sale, collection, reversal
      expect(all[2].reversalOf).toEqual(all[1]._id);
      expect((await store.finance.summary()).receivablesMinor).toBe(14500);
      expect((await db.model('Order').findById(order._id).lean<any>()).paymentStatus).toBe(OrderPaymentStatus.UNPAID);
      await expect(store.payments.voidCollection(String(payment._id), 'again')).rejects.toBeInstanceOf(ConflictException);
      await reconciled();
    });
  });

  describe('the books', () => {
    it('refuses an entry that does not balance', async () => {
      await expect(
        db.transaction((session) =>
          store.journal.post(
            {
              date: new Date(),
              source: { type: 'test', id: new Types.ObjectId(), event: 'x' },
              lines: [
                { account: ACCOUNT.CASH, debitMinor: 100 },
                { account: ACCOUNT.PRODUCT_SALES, creditMinor: 99 },
              ],
            },
            session,
          ),
        ),
      ).rejects.toThrow(/does not balance/);
    });

    it('refuses an entry dated inside a locked period', async () => {
      await db.model('Setting').create({ finance: { lockedThrough: new Date('2026-09-30T21:00:00Z') } });
      const post = (date: string) =>
        db.transaction((session) =>
          store.journal.post(
            {
              date: new Date(date),
              source: { type: 'test', id: new Types.ObjectId(), event: 'x' },
              lines: [
                { account: ACCOUNT.CASH, debitMinor: 100 },
                { account: ACCOUNT.PRODUCT_SALES, creditMinor: 100 },
              ],
            },
            session,
          ),
        );
      await expect(post('2026-09-15T10:00:00Z')).rejects.toBeInstanceOf(ConflictException);
      await expect(post('2026-10-02T10:00:00Z')).resolves.toBeTruthy();
    });

    it('reports a sale in the Cairo day it happened, across the DST change', async () => {
      // 22:30 UTC on 31 Oct 2026 is 00:30 on 1 Nov in Cairo (UTC+2 after DST ends on 29 Oct).
      await db.transaction((session) =>
        store.journal.post(
          {
            date: new Date('2026-10-31T22:30:00Z'),
            source: { type: 'test', id: new Types.ObjectId(), event: 'x' },
            lines: [
              { account: ACCOUNT.RECEIVABLES, debitMinor: 1000 },
              { account: ACCOUNT.PRODUCT_SALES, creditMinor: 1000 },
            ],
          },
          session,
        ),
      );
      expect((await store.finance.summary('2026-10-31', '2026-10-31')).grossProductSalesMinor).toBe(0);
      expect((await store.finance.summary('2026-11-01', '2026-11-01')).grossProductSalesMinor).toBe(1000);
      expect(zonedDayRange('2026-10-29', '2026-10-29', 'Africa/Cairo')).toEqual({
        start: new Date('2026-10-28T21:00:00Z'), // still UTC+3
        end: new Date('2026-10-29T22:00:00Z'), // UTC+2 from the 29th
      });
    });

    it('books an order written before the books from its pounds', async () => {
      const order = await store.place(await store.customer(), [{ productId: await store.product(20), quantity: 2 }]);
      // Strip the minor amounts, as on an order placed before this release.
      await db.model('Order').collection.updateOne(
        { _id: order._id },
        { $unset: { subtotalMinor: 1, discountMinor: 1, shippingFeeMinor: 1, taxMinor: 1, totalMinor: 1, 'items.0.unitPriceMinor': 1, 'items.0.lineTotalMinor': 1, 'items.0.discountMinor': 1 } },
      );
      const delivered = await store.advance(String(order._id));
      expect(delivered.totalMinor).toBe(8500);
      expect((await store.finance.summary()).netRevenueMinor).toBe(8500);
      await reconciled();
    });
  });

  it('the dashboard counts delivered sales as revenue and placed orders as pipeline only', async () => {
    const product = await store.product(100);
    const customer = await store.customer();
    const delivered = await store.place(customer, [{ productId: product, quantity: 1 }]);
    await store.advance(String(delivered._id));
    await store.place(customer, [{ productId: product, quantity: 3 }]); // still pending

    const dash = await store.dashboard.dashboard({ days: '7' });
    expect(dash.current).toMatchObject({ revenue: 145, revenueMinor: 14500, orders: 1, placed: 2, placedValue: 145 + 345 });
    expect(dash.topProducts[0]).toMatchObject({ quantity: 1, revenueMinor: 10000 });
    expect(dash.series.reduce((s: number, d: any) => s + d.revenue, 0)).toBe(145);
  });

  it('exports every order with exact amounts and payment columns', async () => {
    const order = await store.place(await store.customer(), [{ productId: await store.product(150), quantity: 2 }]);
    await store.advance(String(order._id));
    await store.payments.recordCollection(String(order._id), { amount: '100', custody: Custody.STORE });

    let csv = '';
    await store.orders.exportCsv({} as never, async (chunk) => {
      csv += chunk;
    });
    const [header, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    const cells = Object.fromEntries(header.split(',').map((h, i) => [h, row.split(',')[i]]));
    expect(cells).toMatchObject({ subtotal: '300.00', total: '345.00', payment_status: 'partially_paid', collected: '100.00', outstanding: '245.00' });
  });
});
