import { BadRequestException, ConflictException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { MovementType } from '../inventory/enums/movement-type.enum';
import { ACCOUNT } from '../finance/accounts';
import { Custody } from '../finance/schemas/payment.schema';
import { RefundMethod, RefundReason } from '../refunds/schemas/refund.schema';

jest.setTimeout(180_000);

/**
 * Step 4: stock carries its cost. Purchases bring it in at cost and create
 * what is owed to suppliers; sales take it out at moving weighted average;
 * cancellations and restocked returns put it back at the cost it left at.
 * Expected values are examples E2 and E8 and the section 8 comparison.
 */
describe('Costing and buying', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let store: Store;
  const today = () => new Date().toISOString();

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
    store.delivery.price = 0;
  });

  const product = (id: string) => db.model('Product').findById(id).lean<any>().exec();
  const balances = () => store.journal.balances();
  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };
  const supplier = async () => String((await store.purchasing.createSupplier({ name: `Supplier ${new Types.ObjectId()}` }))._id);
  const buy = async (supplierId: string, lines: { productId: string; quantity: number; unitCost: string }[], landedCost?: string) => {
    const draft = await store.purchasing.createPurchase({ supplierId, date: today(), lines, landedCost });
    return store.purchasing.postPurchase(String(draft._id));
  };
  const sell = async (productId: string, quantity: number, to: 'delivered' | 'placed' = 'delivered') => {
    const order = await store.place(await store.customer(), [{ productId, quantity }]);
    if (to === 'delivered') await store.advance(String(order._id));
    return String(order._id);
  };

  it('E8 — freight split by value, payable created, then partly paid', async () => {
    const [b, c] = [await store.product(80, 0), await store.product(50, 0)];
    const s = await supplier();
    const purchase = await buy(s, [
      { productId: b, quantity: 20, unitCost: '40.00' },
      { productId: c, quantity: 10, unitCost: '25.00' },
    ], '50.00');

    expect(purchase.lines.map((l: any) => [l.landedMinor, l.valueMinor])).toEqual([
      [3810, 83810],
      [1190, 26190],
    ]);
    expect(purchase.totalMinor).toBe(110000);
    expect(await product(b)).toMatchObject({ stock: 20, inventoryValueMinor: 83810 });
    expect(await product(c)).toMatchObject({ stock: 10, inventoryValueMinor: 26190 });
    expect((await balances())[ACCOUNT.PAYABLES]).toBe(110000);

    await store.purchasing.paySupplier({ supplierId: s, amount: '500' });
    expect((await store.purchasing.supplier(s)).owedMinor).toBe(60000);
    expect((await balances())[ACCOUNT.PAYABLES]).toBe(60000);
    await expect(store.purchasing.paySupplier({ supplierId: s, amount: '600.01' })).rejects.toThrow('Only 600.00 is owed');
    await reconciled();
  });

  it('section 8 — buy 10 at 100.00 and 10 at 130.00, sell 15: COGS 1,725.00, 575.00 left', async () => {
    const item = await store.product(200, 0);
    const s = await supplier();
    await buy(s, [{ productId: item, quantity: 10, unitCost: '100' }]);
    await buy(s, [{ productId: item, quantity: 10, unitCost: '130' }]);
    await sell(item, 15);

    expect(await product(item)).toMatchObject({ stock: 5, inventoryValueMinor: 57500 });
    const summary = await store.finance.summary();
    expect(summary).toMatchObject({ grossProductSalesMinor: 300000, costOfSalesMinor: 172500, grossProfitMinor: 127500, uncostedLines: 0 });
    await reconciled();
  });

  it('E2 — four single-unit sales after buying at 10.00 and 10.01 cost exactly 40.01', async () => {
    const item = await store.product(20, 0);
    const s = await supplier();
    await buy(s, [{ productId: item, quantity: 3, unitCost: '10.00' }]);
    await buy(s, [{ productId: item, quantity: 1, unitCost: '10.01' }]);
    const costs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const orderId = await sell(item, 1);
      costs.push((await db.model('Order').findById(orderId).lean<any>()).items[0].costMinor);
    }
    expect(costs).toEqual([1000, 1000, 1001, 1000]);
    expect(await product(item)).toMatchObject({ stock: 0, inventoryValueMinor: 0 });
    await reconciled();
  });

  it('a cancelled order puts its goods back at the cost they left at', async () => {
    const item = await store.product(150, 10, 90);
    const orderId = await sell(item, 2, 'placed');
    expect((await balances())[ACCOUNT.GOODS_AWAITING_DELIVERY]).toBe(18000);
    await store.orders.updateStatus(orderId, OrderStatus.CANCELLED, undefined, undefined, 'shop.test');

    expect((await balances())).toMatchObject({ [ACCOUNT.GOODS_AWAITING_DELIVERY]: 0, [ACCOUNT.INVENTORY]: 90000, [ACCOUNT.COGS]: 0 });
    expect(await product(item)).toMatchObject({ stock: 10, inventoryValueMinor: 90000 });
    await reconciled();
  });

  it('a restocked refund takes its cost out of COGS (E4 with cost)', async () => {
    const item = await store.product(150, 10, 90);
    const orderId = await sell(item, 2);
    await store.payments.recordCollection(orderId, { amount: '300', custody: Custody.STORE });
    const refund = await store.refunds.request(
      { orderId, lines: [{ lineIndex: 0, quantity: 1, restock: true }], reason: RefundReason.CHANGED_MIND, method: RefundMethod.CASH },
      undefined,
    );
    await store.refunds.execute(String(refund._id), undefined, 'shop.test');

    expect(await product(item)).toMatchObject({ stock: 9, inventoryValueMinor: 81000 });
    expect((await store.finance.summary())).toMatchObject({ productReturnsMinor: 15000, costOfSalesMinor: 9000, grossProfitMinor: 6000 });
    await reconciled();
  });

  it('a backorder is costed at an estimate, and the difference is booked when stock arrives', async () => {
    const item = await store.product(50, 2, 10);
    await db.model('Product').updateOne({ _id: item }, { allowBackorder: true });
    const orderId = await sell(item, 5);
    const line = (await db.model('Order').findById(orderId).lean<any>()).items[0];
    expect(line).toMatchObject({ costMinor: 5000, costEstimated: true });

    const s = await supplier();
    await buy(s, [{ productId: item, quantity: 5, unitCost: '11.00' }]);
    expect(await product(item)).toMatchObject({ stock: 2, inventoryValueMinor: 2200 });
    // 3 units sold short at 10.00 really cost 11.00: 3.00 more cost of goods sold.
    expect((await store.finance.summary()).costOfSalesMinor).toBe(5300);
    await reconciled();
  });

  it('damage and stock-take differences go to inventory losses at average cost', async () => {
    const item = await store.product(50, 10, 20);
    await store.inventory.adjust({ productId: item, type: MovementType.DAMAGE, quantity: 2, reason: 'broken' });
    await store.inventory.stockTake({ productId: item, countedQuantity: 9 });

    expect(await product(item)).toMatchObject({ stock: 9, inventoryValueMinor: 18000 });
    expect((await balances())[ACCOUNT.INVENTORY_LOSSES]).toBe(2000); // 4,000 lost, 2,000 found
    await reconciled();
  });

  it('stock with no cost: sales are uncosted, purchases wait for its opening cost', async () => {
    const item = await store.product(50, 4); // from before the books
    await sell(item, 1);
    expect((await store.finance.summary())).toMatchObject({ costOfSalesMinor: 0, uncostedLines: 1 });

    const s = await supplier();
    await expect(buy(s, [{ productId: item, quantity: 5, unitCost: '12' }])).rejects.toThrow(/set their opening cost first/);
    await store.inventory.setOpeningCost(item, undefined, 1000);
    await expect(store.inventory.setOpeningCost(item, undefined, 1000)).rejects.toBeInstanceOf(ConflictException);
    expect((await balances())).toMatchObject({ [ACCOUNT.INVENTORY]: 3000, [ACCOUNT.EQUITY]: 3000 });

    // The failed post left its draft; post a fresh one now the stock has a cost.
    await buy(s, [{ productId: item, quantity: 5, unitCost: '12' }]);
    expect(await product(item)).toMatchObject({ stock: 8, inventoryValueMinor: 9000 });
    await reconciled();
  });

  it('goods back to the supplier leave at what they were bought for, and only what is on the shelf', async () => {
    const [b, c] = [await store.product(80, 0), await store.product(50, 0)];
    const s = await supplier();
    const purchase = await buy(s, [
      { productId: b, quantity: 20, unitCost: '40.00' },
      { productId: c, quantity: 10, unitCost: '25.00' },
    ], '50.00');

    await store.purchasing.returnToSupplier({ purchaseId: String(purchase._id), lines: [{ lineIndex: 0, quantity: 5 }] });
    // 5 of 20 at 838.10 for the line: 209.525 → 209.53 (half up).
    expect(await product(b)).toMatchObject({ stock: 15, inventoryValueMinor: 83810 - 20953 });
    expect((await store.purchasing.supplier(s)).owedMinor).toBe(110000 - 20953);

    await sell(c, 8);
    await expect(
      store.purchasing.returnToSupplier({ purchaseId: String(purchase._id), lines: [{ lineIndex: 1, quantity: 5 }] }),
    ).rejects.toThrow(/on the shelf/);
    // The last 15 of line 1 take exactly what is left of its value, emptying it to zero.
    await store.purchasing.returnToSupplier({ purchaseId: String(purchase._id), lines: [{ lineIndex: 0, quantity: 15 }] });
    expect(await product(b)).toMatchObject({ stock: 0, inventoryValueMinor: 0 });
    await reconciled();
  });

  it('drafts can change until posted; a posted purchase is fixed', async () => {
    const item = await store.product(80, 0);
    const s = await supplier();
    const draft = await store.purchasing.createPurchase({ supplierId: s, date: today(), lines: [{ productId: item, quantity: 2, unitCost: '10' }] });
    const edited = await store.purchasing.updatePurchase(String(draft._id), { lines: [{ productId: item, quantity: 3, unitCost: '10' }] });
    expect(edited.totalMinor).toBe(3000);
    expect(await product(item)).toMatchObject({ stock: 0 }); // nothing moved yet

    await store.purchasing.postPurchase(String(draft._id));
    await expect(store.purchasing.postPurchase(String(draft._id))).rejects.toBeInstanceOf(ConflictException);
    await expect(store.purchasing.updatePurchase(String(draft._id), { notes: 'x' })).rejects.toBeInstanceOf(ConflictException);
    await expect(store.purchasing.deletePurchase(String(draft._id))).rejects.toBeInstanceOf(ConflictException);
    await expect(
      store.purchasing.createPurchase({ supplierId: s, date: new Date(Date.now() + 86_400_000).toISOString(), lines: [{ productId: item, quantity: 1, unitCost: '1' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
