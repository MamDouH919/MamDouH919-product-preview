import { ConflictException } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';
import { Order } from '../orders/schemas/order.schema';
import { StockMovement } from '../inventory/schemas/stock-movement.schema';

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
    const inventory = new InventoryService(db.model<Product>(Product.name), db.model<StockMovement>(StockMovement.name), db, {} as never);
    products = new ProductsService(db.model<Product>(Product.name), db.model<Order>(Order.name), inventory);
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

  it('refuses one that has been ordered', async () => {
    const product = await make();
    await db.model('Order').collection.insertOne({ orderNumber: 1, items: [{ product: product._id }] });
    await expect(products.remove(String(product._id))).rejects.toBeInstanceOf(ConflictException);
    expect(await db.model('Product').exists({ _id: product._id })).not.toBeNull();
  });

  it('refuses one with stock history', async () => {
    const product = await make();
    await db.model('StockMovement').create({ product: product._id, type: 'opening', quantity: 5, balanceAfter: 5 });
    await expect(products.remove(String(product._id))).rejects.toBeInstanceOf(ConflictException);
  });
});
