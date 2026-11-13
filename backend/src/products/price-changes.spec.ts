import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { buildStore, Store } from '../../test/helpers/store';
import { ProductsService } from './products.service';
import { diffProductPrices } from './price-diff';
import { PriceChangeStore } from '../common/tenant/price-change-store';
import type { PriceChangeDraft } from '../common/tenant/price-change-recorder';

jest.setTimeout(180_000);

describe('price change tracking', () => {
  describe('diffProductPrices', () => {
    const base = { _id: 'p1', name: { en: 'Tea', ar: 'شاي' }, sku: 'TEA-1' };

    it('reports a changed selling price with who it belongs to', () => {
      const out = diffProductPrices({ ...base, price: 10 }, { ...base, price: 12 }, 'product_edit');
      expect(out).toEqual([
        { productId: 'p1', productName: 'Tea', sku: 'TEA-1', source: 'product_edit', kind: 'price', oldValue: 10, newValue: 12 },
      ]);
    });

    it('says nothing when nothing priced changed', () => {
      const same = { ...base, price: 10, compareAtPrice: 15, variants: [{ _id: 'v1', label: 'S', price: 5 }] };
      expect(diffProductPrices(same, { ...same, name: { en: 'Renamed' } }, 'product_edit')).toEqual([]);
    });

    it('tracks the price before a discount separately, including clearing it', () => {
      const out = diffProductPrices({ ...base, price: 10, compareAtPrice: 15 }, { ...base, price: 10, compareAtPrice: null }, 'product_edit');
      expect(out).toMatchObject([{ kind: 'compareAtPrice', oldValue: 15, newValue: null }]);
    });

    it('matches variants by id, and names the variant', () => {
      const before = { ...base, variants: [{ _id: 'v1', label: 'S', price: 5 }, { _id: 'v2', label: 'L', price: 8 }] };
      const after = { ...base, variants: [{ _id: 'v2', label: 'Large', price: 9 }, { _id: 'v1', label: 'S', price: 5 }] };
      expect(diffProductPrices(before, after, 'product_edit')).toMatchObject([
        { kind: 'price', variantLabel: 'Large', oldValue: 8, newValue: 9 },
      ]);
    });

    it('treats a new product as starting from nothing, and skips what it never had', () => {
      const out = diffProductPrices(null, { ...base, price: 10 }, 'product_created');
      expect(out).toMatchObject([{ kind: 'price', oldValue: null, newValue: 10, source: 'product_created' }]);
    });

    it('treats a variant added in an edit as new', () => {
      const out = diffProductPrices({ ...base, variants: [] }, { ...base, variants: [{ _id: 'v9', label: 'XL', price: 20 }] }, 'product_edit');
      expect(out).toMatchObject([{ variantLabel: 'XL', oldValue: null, newValue: 20 }]);
    });
  });

  describe('against a store and the platform log', () => {
    let replSet: MongoMemoryReplSet;
    let db: Connection;
    let store: Store;
    let log: PriceChangeStore;
    let logged: { host?: string; userId?: string; drafts: PriceChangeDraft[] }[];
    let products: ProductsService;
    const recorder = { record: (host: string | undefined, userId: string | undefined, drafts: PriceChangeDraft[]) => {
      if (drafts.length) logged.push({ host, userId, drafts });
    },
  };
    const all = () => logged.flatMap((l) => l.drafts);
    const product = (id: string) => db.model('Product').findById(id).lean<any>().exec();

    beforeAll(async () => {
      replSet = await startReplSet();
      db = await tenantConnection(replSet, 'shop');
      log = new PriceChangeStore(db);
    });

    afterAll(async () => {
      await db?.close();
      await replSet?.stop();
    });

    beforeEach(async () => {
      await Promise.all(db.modelNames().map((name) => db.model(name).deleteMany({})));
      logged = [];
      store = buildStore(db);
      // The services take the recorder from Nest; here a stand-in that remembers.
      Object.assign(store.inventory, { storeHost: 'shop.test', priceLog: recorder });
      products = new ProductsService(db.model('Product') as never, db.model('Order') as never, db.model('DeletedProduct') as never, store.inventory, 'shop.test', recorder as never);
    });

    const supplier = async () => String((await store.purchasing.createSupplier({ name: `S ${new Types.ObjectId()}` }))._id);
    const buy = async (supplierId: string, lines: { productId: string; quantity: number; unitCost: string }[]) => {
      const draft = await store.purchasing.createPurchase({ supplierId, date: new Date().toISOString(), lines });
      return store.purchasing.postPurchase(String(draft._id));
    };

    it('logs a selling price edit with the store and the editor', async () => {
      const id = await store.product(50, 0);
      logged = [];
      await products.update(id, { price: 65 } as never, [], 'u1');
      expect(logged).toHaveLength(1);
      expect(logged[0]).toMatchObject({ host: 'shop.test', userId: 'u1' });
      expect(logged[0].drafts).toMatchObject([{ kind: 'price', oldValue: 50, newValue: 65, source: 'product_edit' }]);
    });

    it('logs nothing for an edit that leaves prices alone', async () => {
      const id = await store.product(50, 0);
      logged = [];
      await products.update(id, { price: 50, name: { en: 'New name' } } as never, [], 'u1');
      expect(logged).toEqual([]);
    });

    it('logs a purchase that moves the cost, in pounds', async () => {
      const id = await store.product(50, 4, 10); // 4 units at 10.00
      logged = []; // the setup's own opening stock isn't what is under test
      await buy(await supplier(), [{ productId: id, quantity: 5, unitCost: '12' }]);
      expect(all()).toMatchObject([{ kind: 'cost', oldValue: 10, newValue: 11.11, source: 'purchase' }]);
    });

    it('logs the first cost and its correction', async () => {
      const id = await store.product(50, 4); // from before the books, no cost yet
      logged = [];
      const editor = String(new Types.ObjectId());
      await store.inventory.setOpeningCost(id, undefined, 1000, editor);
      await store.inventory.correctOpeningCost(id, undefined, 1250, editor);
      expect(all()).toMatchObject([
        { kind: 'cost', oldValue: null, newValue: 10, source: 'opening_cost' },
        { kind: 'cost', oldValue: 10, newValue: 12.5, source: 'opening_cost_corrected' },
      ]);
      expect(logged.every((l) => l.userId === editor)).toBe(true);
    });

    it('leaves no trace of a purchase that rolled back', async () => {
      const valued = await store.product(50, 4, 10);
      const uncosted = await store.product(50, 4);
      logged = [];
      const draft = await store.purchasing.createPurchase({
        supplierId: await supplier(),
        date: new Date().toISOString(),
        lines: [
          { productId: valued, quantity: 5, unitCost: '12' },
          { productId: uncosted, quantity: 5, unitCost: '12' },
        ],
      });
      await expect(store.purchasing.postPurchase(String(draft._id))).rejects.toThrow();
      expect(all()).toEqual([]);
      expect((await product(valued)).stock).toBe(4);
    });

    it('does not log a sale, which takes stock out at the average', async () => {
      const id = await store.product(50, 10, 10);
      logged = [];
      await store.advance(String((await store.place(await store.customer(), [{ productId: id, quantity: 3 }]))._id));
      expect(all()).toEqual([]);
    });

    it('stores, filters and summarises changes for the platform', async () => {
      const at = new Date('2026-11-10T10:00:00Z');
      const common = { productId: 'p1', productName: 'Green tea', source: 'product_edit' as const };
      await log.record([
        { ...common, host: 'a.shop', kind: 'price', oldValue: 10, newValue: 12, userName: 'Mona', at },
        { ...common, host: 'a.shop', kind: 'cost', oldValue: null, newValue: 7, source: 'opening_cost', at },
        { ...common, host: 'b.shop', productId: 'p2', productName: 'Coffee', sku: 'COF', kind: 'price', oldValue: 20, newValue: 15, at: new Date() },
      ]);

      const first = await log.list({ page: 1, limit: 10 });
      expect(first.total).toBe(3);
      expect(first.items[0]).toMatchObject({ productName: 'Coffee', delta: -5, deltaPercent: -25 });

      const green = (await log.list({ host: 'a.shop', page: 1, limit: 10 })).items;
      expect(green.map((i) => i.kind).sort()).toEqual(['cost', 'price']);
      expect(green.find((i) => i.kind === 'cost')).toMatchObject({ oldValue: null, delta: null, deltaPercent: null });
      expect(green.find((i) => i.kind === 'price')).toMatchObject({ delta: 2, deltaPercent: 20, userName: 'Mona' });

      expect((await log.list({ q: 'cof', page: 1, limit: 10 })).total).toBe(1);
      expect((await log.list({ kind: 'cost', page: 1, limit: 10 })).total).toBe(1);
      expect((await log.list({ from: new Date('2026-11-09'), to: new Date('2026-11-11'), page: 1, limit: 10 })).total).toBe(2);
      expect((await log.list({ page: 2, limit: 2 })).items).toHaveLength(1);

      expect(await log.summary(3650)).toEqual({ total: 3, byKind: { price: 2, compareAtPrice: 0, cost: 1 }, products: 2 });
      expect((await log.summary(3650, 'b.shop')).total).toBe(1);
    });
  });
});
