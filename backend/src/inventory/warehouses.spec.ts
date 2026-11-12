import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { MovementType } from './enums/movement-type.enum';

jest.setTimeout(180_000);

/**
 * Warehouses: sales take stock from the main one; the others hold stock that
 * reaches customers by a transfer, which moves units but never value. With
 * pre-orders on, a customer may buy what the main warehouse is out of while
 * another still holds it — the order then can't ship until it arrives.
 */
describe('Warehouses, transfers and pre-orders', () => {
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
    store = buildStore(db, undefined, 3);
    store.delivery.price = 0;
  });

  const product = (id: string) => db.model('Product').findById(id).lean<any>().exec();
  const units = (p: any, warehouse: unknown) => p.stocks.find((e: any) => String(e.warehouse) === String(warehouse))?.qty ?? 0;
  const reconciled = async () => {
    const report = await store.reconciliation.run();
    expect(report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.offenders.join('; ')}`)).toEqual([]);
  };
  const saudi = async () => store.warehouses.create({ name: { en: 'Riyadh', ar: 'الرياض' }, code: 'RUH' });
  const preorders = (on: boolean) => db.model('Setting').updateOne({}, { $set: { preorderEnabled: on } }, { upsert: true }).exec();
  const transfer = (from: unknown, to: unknown, productId: string, quantity: number) =>
    store.inventory.transfer({ fromWarehouseId: String(from), toWarehouseId: String(to), lines: [{ productId, quantity }] });
  /** A costed product with `main` units in the main warehouse and `other` in Riyadh. */
  const stocked = async (main: number, other: number) => {
    const ruh = await saudi();
    const id = await store.product(100, main, 40);
    if (other) {
      await store.inventory.adjust({ productId: id, warehouseId: String(ruh._id), type: MovementType.ADJUSTMENT_IN, quantity: other });
    }
    return { id, ruh, main: await store.warehouses.main() };
  };

  it('gives every store a main warehouse holding the stock it already had', async () => {
    const id = await store.product(100, 7);
    const main = await store.warehouses.main();
    expect(main.isMain).toBe(true);
    const [row] = await store.inventory.getLevels({});
    expect(row).toMatchObject({ productId: id, stock: 7, totalStock: 7, stocks: [{ warehouseId: String(main._id), qty: 7 }] });
    // Asking again doesn't make a second one.
    expect(String((await store.warehouses.main())._id)).toBe(String(main._id));
    expect((await store.warehouses.list()).data).toHaveLength(1);
  });

  it('keeps to the number of warehouses the platform allows', async () => {
    await store.warehouses.main();
    await saudi();
    await store.warehouses.create({ name: { en: 'Jeddah' }, code: 'JED' });
    await expect(store.warehouses.create({ name: { en: 'Dammam' }, code: 'DMM' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(store.warehouses.create({ name: { en: 'Again' }, code: 'ruh' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('transfers units without moving value or touching the books', async () => {
    const { id, ruh, main } = await stocked(2, 10);
    const before = await product(id);
    const entries = await db.model('JournalEntry').countDocuments();

    const t = await transfer(ruh._id, main._id, id, 6);
    expect(t.transferNumber).toBeGreaterThan(0);
    expect(t.totalUnits).toBe(6);

    const after = await product(id);
    expect(after.stock).toBe(8);
    expect(units(after, main._id)).toBe(8);
    expect(units(after, ruh._id)).toBe(4);
    expect(after.inventoryValueMinor).toBe(before.inventoryValueMinor);
    expect(await db.model('JournalEntry').countDocuments()).toBe(entries);

    const moves = await db.model('StockMovement').find({ transfer: t._id }).lean<any[]>().exec();
    expect(moves.map((m) => [m.type, m.quantity, m.balanceAfter]).sort()).toEqual(
      [
        [MovementType.TRANSFER_IN, 6, 8],
        [MovementType.TRANSFER_OUT, -6, 4],
      ].sort(),
    );
    await reconciled();
  });

  it('refuses a transfer of more than the warehouse holds, moving nothing', async () => {
    const { id, ruh, main } = await stocked(2, 3);
    const other = await store.product(50, 0);
    await expect(
      store.inventory.transfer({
        fromWarehouseId: String(ruh._id),
        toWarehouseId: String(main._id),
        lines: [
          { productId: id, quantity: 3 },
          { productId: other, quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const p = await product(id);
    expect([p.stock, units(p, ruh._id)]).toEqual([2, 3]);
    expect(await db.model('StockTransfer').countDocuments()).toBe(0);
  });

  it('receives a purchase into the warehouse it names', async () => {
    const ruh = await saudi();
    const id = await store.product(100, 0);
    const supplierId = String((await store.purchasing.createSupplier({ name: 'Supplier' }))._id);
    const draft = await store.purchasing.createPurchase({
      supplierId,
      warehouseId: String(ruh._id),
      date: new Date().toISOString(),
      lines: [{ productId: id, quantity: 5, unitCost: '30.00' }],
    });
    await store.purchasing.postPurchase(String(draft._id));

    const p = await product(id);
    expect(p.stock).toBe(0);
    expect(units(p, ruh._id)).toBe(5);
    expect(p.inventoryValueMinor).toBe(15000);
    await reconciled();
  });

  it('sells only from the main warehouse while pre-orders are off', async () => {
    const { id } = await stocked(2, 5);
    await preorders(false);
    await expect(store.place(await store.customer(), [{ productId: id, quantity: 3 }])).rejects.toBeInstanceOf(BadRequestException);
    expect((await product(id)).stock).toBe(2);
  });

  it('takes a pre-order for what another warehouse holds, and ships it once transferred', async () => {
    const { id, ruh, main } = await stocked(2, 5);
    await preorders(true);

    const quote = await store.orders.quote([{ productId: id, quantity: 4 }]);
    expect(quote.items[0]).toMatchObject({ available: 2, preorderAvailable: 5, preorderQuantity: 2 });

    const order = await store.place(await store.customer(), [{ productId: id, quantity: 4 }]);
    const placed = await db.model('Order').findById(order._id).lean<any>().exec();
    expect(placed.preorder).toBe(true);
    expect(placed.items[0].preorderQuantity).toBe(2);

    const p = await product(id);
    expect(p.stock).toBe(-2);
    expect(units(p, ruh._id)).toBe(5);
    // Sold from stock the store owns, so it is costed at its average, not estimated.
    expect(placed.items[0].costEstimated).toBe(false);

    await store.orders.updateStatus(String(order._id), OrderStatus.CONFIRMED, undefined, undefined, 'shop.test');
    await expect(
      store.orders.updateStatus(String(order._id), OrderStatus.SHIPPED, undefined, undefined, 'shop.test'),
    ).rejects.toBeInstanceOf(ConflictException);

    await transfer(ruh._id, main._id, id, 2);
    await store.orders.updateStatus(String(order._id), OrderStatus.SHIPPED, undefined, undefined, 'shop.test');
    await store.orders.updateStatus(String(order._id), OrderStatus.DELIVERED, undefined, undefined, 'shop.test');
    await reconciled();
  });

  it('never pre-sells more than the other warehouses hold', async () => {
    const { id } = await stocked(0, 5);
    await preorders(true);
    await store.place(await store.customer(), [{ productId: id, quantity: 3 }]);
    await expect(store.place(await store.customer(), [{ productId: id, quantity: 3 }])).rejects.toBeInstanceOf(BadRequestException);
    await store.place(await store.customer(), [{ productId: id, quantity: 2 }]);
    expect((await product(id)).stock).toBe(-5);
  });

  it('keeps promised units where they are until they are transferred', async () => {
    const { id, ruh, main } = await stocked(0, 5);
    await preorders(true);
    await store.place(await store.customer(), [{ productId: id, quantity: 3 }]);

    const damage = (quantity: number) =>
      store.inventory.adjust({ productId: id, warehouseId: String(ruh._id), type: MovementType.DAMAGE, quantity });
    await expect(damage(3)).rejects.toBeInstanceOf(BadRequestException);
    await damage(2);
    // The owed units can still go to the main warehouse, which is where they're promised.
    await transfer(ruh._id, main._id, id, 3);
    const p = await product(id);
    expect([p.stock, units(p, ruh._id)]).toEqual([0, 0]);
    await reconciled();
  });

  it('puts a cancelled pre-order back in the main warehouse', async () => {
    const { id } = await stocked(1, 5);
    await preorders(true);
    const order = await store.place(await store.customer(), [{ productId: id, quantity: 4 }]);
    expect((await product(id)).stock).toBe(-3);
    await store.orders.updateStatus(String(order._id), OrderStatus.CANCELLED, undefined, undefined, 'shop.test');
    expect((await product(id)).stock).toBe(1);
    await reconciled();
  });

  it('moves sales to another main warehouse, but not while the current one owes pre-orders', async () => {
    const { id, ruh } = await stocked(0, 5);
    await preorders(true);
    const order = await store.place(await store.customer(), [{ productId: id, quantity: 1 }]);
    await expect(store.warehouses.setMain(String(ruh._id))).rejects.toBeInstanceOf(ConflictException);

    await store.orders.updateStatus(String(order._id), OrderStatus.CANCELLED, undefined, undefined, 'shop.test');
    const legacy = await store.product(10, 4);
    await store.warehouses.setMain(String(ruh._id));

    expect((await store.warehouses.main())._id.toString()).toBe(String(ruh._id));
    expect((await product(id)).stock).toBe(5);
    // Stock from before warehouses stays with the old main warehouse.
    const old = await product(legacy);
    expect(old.stock).toBe(0);
    expect(old.stocks).toHaveLength(1);
    expect(old.stocks[0].qty).toBe(4);
  });

  it('keeps the warehouses of each variant apart', async () => {
    const ruh = await saudi();
    const main = await store.warehouses.main();
    const created = await db.model('Product').create({
      name: { en: 'Shirt' },
      category: new Types.ObjectId(),
      slug: `shirt-${new Types.ObjectId()}`,
      price: 100,
      variants: [
        { label: 'S', stock: 3 },
        { label: 'M', stock: 0 },
      ],
    });
    const id = String(created._id);
    const [s, m] = created.variants.map((v: any) => String(v._id));
    await store.inventory.adjust({ productId: id, variantId: m, warehouseId: String(ruh._id), type: MovementType.ADJUSTMENT_IN, quantity: 4 });
    await preorders(true);
    await store.place(await store.customer(), [{ productId: id, variantId: m, quantity: 1 } as never]);
    await store.inventory.transfer({
      fromWarehouseId: String(main._id),
      toWarehouseId: String(ruh._id),
      lines: [{ productId: id, variantId: s, quantity: 2 }],
    });

    const p = await product(id);
    const [vs, vm] = p.variants;
    expect([vs.stock, units(vs, main._id), units(vs, ruh._id)]).toEqual([1, 1, 2]);
    expect([vm.stock, units(vm, main._id), units(vm, ruh._id)]).toEqual([-1, -1, 4]);
    const [rowS, rowM] = await store.inventory.getLevels({});
    expect([rowS.totalStock, rowM.totalStock, rowM.preorderStock]).toEqual([3, 3, 3]);
  });

  it('closes only an empty warehouse, and deletes only an unused one', async () => {
    const { id, ruh, main } = await stocked(0, 2);
    await expect(store.warehouses.update(String(ruh._id), { isActive: false })).rejects.toBeInstanceOf(ConflictException);
    await expect(store.warehouses.update(String(main._id), { isActive: false })).rejects.toBeInstanceOf(BadRequestException);
    await transfer(ruh._id, main._id, id, 2);
    await store.warehouses.update(String(ruh._id), { isActive: false });
    await expect(store.warehouses.remove(String(ruh._id))).rejects.toBeInstanceOf(ConflictException);

    const spare = await store.warehouses.create({ name: { en: 'Spare' }, code: 'SPR' });
    await store.warehouses.remove(String(spare._id));
    expect(await db.model('Warehouse').exists({ _id: new Types.ObjectId(String(spare._id)) })).toBeNull();
  });
});
