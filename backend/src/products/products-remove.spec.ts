import { ConflictException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';
import { Order } from '../orders/schemas/order.schema';
import { StockMovement } from '../inventory/schemas/stock-movement.schema';
import { StoreModule } from '../common/tenant/store-plan';

jest.setTimeout(120_000);

describe('ProductsService.remove', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let products: ProductsService;
  const make = () =>
    db.model('Product').create({ name: { en: 'Tea' }, category: new Types.ObjectId(), slug: `tea-${new Types.ObjectId()}` });

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
    const inventory = new InventoryService(
      db.model<Product>(Product.name),
      db.model<StockMovement>(StockMovement.name),
      db.model('StockTransfer') as never,
      db.model('Counter') as never,
      db,
      {} as never,
      {} as never,
    );
    products = new ProductsService(db.model<Product>(Product.name), db.model<Order>(Order.name), db.model('DeletedProduct') as never, inventory);
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  it('deletes a product nothing refers to', async () => {
    const product = await make();
    await products.remove(String(product._id));
    expect(await db.model('Product').exists({ _id: product._id })).toBeNull();
  });

  it('refuses one on an order that is not finished', async () => {
    const product = await make();
    await db.model('Order').collection.insertOne({ orderNumber: 1, status: 'pending', items: [{ product: product._id }] });
    await expect(products.remove(String(product._id))).rejects.toBeInstanceOf(ConflictException);
    expect(await db.model('Product').exists({ _id: product._id })).not.toBeNull();
  });

  it('deletes one whose orders are all finished, keeping a copy', async () => {
    const product = await make();
    await db.model('Order').collection.insertMany([
      { orderNumber: 2, status: 'delivered', items: [{ product: product._id }] },
      { orderNumber: 3, status: 'cancelled', items: [{ product: product._id }] },
    ]);
    await products.remove(String(product._id));
    expect(await db.model('Product').exists({ _id: product._id })).toBeNull();
    const kept = await db.model('DeletedProduct').findById(product._id).lean<{ snapshot: { name: { en: string } } }>();
    expect(kept?.snapshot.name.en).toBe('Tea');
  });

  it('refuses one that still holds stock, and deletes it once the stock is gone', async () => {
    const product = await db.model('Product').create({
      name: { en: 'Tea' },
      category: new Types.ObjectId(),
      slug: `tea-${new Types.ObjectId()}`,
      trackStock: true,
      stock: 4,
      stocks: [{ warehouse: new Types.ObjectId(), qty: 4 }],
      inventoryValueMinor: 40000,
    });
    await expect(products.remove(String(product._id))).rejects.toBeInstanceOf(ConflictException);
    expect(await db.model('Product').exists({ _id: product._id })).not.toBeNull();

    await db.model('Product').updateOne({ _id: product._id }, { $set: { stock: 0, stocks: [], inventoryValueMinor: 0 } });
    await products.remove(String(product._id));
    expect(await db.model('Product').exists({ _id: product._id })).toBeNull();
  });

  it('refuses one whose value sits on a variant', async () => {
    const product = await db.model('Product').create({
      name: { en: 'Tea' },
      category: new Types.ObjectId(),
      slug: `tea-${new Types.ObjectId()}`,
      trackStock: true,
      variants: [{ label: 'Large', price: 10, stock: 0, inventoryValueMinor: 5000 }],
    });
    await expect(products.remove(String(product._id))).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to give a product that holds stock its first variants', async () => {
    const product = await db.model('Product').create({
      name: { en: 'Tea' },
      category: new Types.ObjectId(),
      slug: `tea-${new Types.ObjectId()}`,
      trackStock: true,
      stock: 3,
      stocks: [{ warehouse: new Types.ObjectId(), qty: 3 }],
      inventoryValueMinor: 30000,
    });
    await expect(
      products.update(String(product._id), { variants: [{ label: 'Large', price: 10, stock: 0 }] } as never, []),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(((await db.model('Product').findById(product._id).lean()) as any).variants ?? []).toHaveLength(0);
  });

  describe('on a plan without the inventory module', () => {
    const withoutStockBooks = () =>
      new ProductsService(db.model<Product>(Product.name), db.model<Order>(Order.name), db.model('DeletedProduct') as never, products['inventoryService'], 'shop.test', undefined, [StoreModule.ORDERS]);
    const stocked = () =>
      db.model('Product').create({
        name: { en: 'Tea' },
        category: new Types.ObjectId(),
        slug: `tea-${new Types.ObjectId()}`,
        trackStock: true,
        stock: 4,
        stocks: [{ warehouse: new Types.ObjectId(), qty: 4 }],
        inventoryValueMinor: 40000,
      });

    it('still deletes a product, since there is no stock take to clear it with', async () => {
      const product = await stocked();
      await withoutStockBooks().remove(String(product._id));
      expect(await db.model('Product').exists({ _id: product._id })).toBeNull();
    });

    it('still gives it variants', async () => {
      const product = await stocked();
      await withoutStockBooks().update(String(product._id), { variants: [{ label: 'Large', price: 10, stock: 0 }] } as never, []);
      expect(((await db.model('Product').findById(product._id).lean()) as any).variants).toHaveLength(1);
    });

    it('deletes an untracked product however it was made', async () => {
      const product = await db.model('Product').create({ name: { en: 'Tea' }, category: new Types.ObjectId(), slug: `tea-${new Types.ObjectId()}`, trackStock: false, stock: 9 });
      await products.remove(String(product._id));
      expect(await db.model('Product').exists({ _id: product._id })).toBeNull();
    });
  });

  it('deletes one with stock history and leaves the movements', async () => {
    const product = await make();
    await db.model('StockMovement').create({ product: product._id, type: 'opening', quantity: 5, balanceAfter: 5 });
    await products.remove(String(product._id));
    expect(await db.model('Product').exists({ _id: product._id })).toBeNull();
    expect(await db.model('StockMovement').countDocuments({ product: product._id })).toBe(1);
  });
});
