import { Connection, Model, Schema, Types } from 'mongoose';

/** What changed: the selling price, the price before a discount, or what a unit costs the store. */
export type PriceKind = 'price' | 'compareAtPrice' | 'cost';
export const PRICE_KINDS: readonly PriceKind[] = ['price', 'compareAtPrice', 'cost'];

/** What caused the change, for telling an edit from a purchase at a glance. */
export type PriceSource = 'product_created' | 'product_edit' | 'purchase' | 'opening_stock' | 'opening_cost' | 'opening_cost_corrected';
export const PRICE_SOURCES: readonly PriceSource[] = [
  'product_created',
  'product_edit',
  'purchase',
  'opening_stock',
  'opening_cost',
  'opening_cost_corrected',
];

/** Kept this long: the point is to look back and compare. */
const TTL_SECONDS = 400 * 24 * 60 * 60;

/** One price or cost change, in the store's currency (major units, e.g. 12.5), before it is stored. */
export interface PriceChangeInput {
  host: string;
  productId: string;
  productName: string;
  sku?: string;
  variantLabel?: string;
  kind: PriceKind;
  /** Null when there was none before (a new product, a first cost). */
  oldValue: number | null;
  /** Null when the price was cleared. */
  newValue: number | null;
  source: PriceSource;
  /** Who made it, when a person did. */
  userId?: string;
  userName?: string;
  userEmail?: string;
  at?: Date;
}

interface StoredPriceChange extends Omit<PriceChangeInput, 'at'> {
  at: Date;
}

const PriceChangeSchema = new Schema<StoredPriceChange>(
  {
    host: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    sku: String,
    variantLabel: String,
    kind: { type: String, enum: PRICE_KINDS, required: true, index: true },
    oldValue: { type: Number, default: null },
    newValue: { type: Number, default: null },
    source: { type: String, enum: PRICE_SOURCES, required: true },
    userId: String,
    userName: String,
    userEmail: String,
    at: { type: Date, required: true, index: true, expires: TTL_SECONDS },
  },
  { collection: 'price_changes' },
);

export interface PriceChangeQuery {
  host?: string;
  kind?: PriceKind;
  source?: PriceSource;
  /** Matches the product name, variant or SKU. */
  q?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface PriceChangeView extends Omit<StoredPriceChange, 'sku' | 'variantLabel' | 'userId' | 'userName' | 'userEmail'> {
  id: string;
  sku: string | null;
  variantLabel: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  /** New less old; null when either is missing. */
  delta: number | null;
  /** The change as a share of the old value; null when it can't be worked out. */
  deltaPercent: number | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every price and cost change from every store, kept in the platform database so the platform can follow them. */
export class PriceChangeStore {
  private readonly model: Model<StoredPriceChange>;

  constructor(connection: Connection) {
    this.model = connection.model<StoredPriceChange>('PriceChange', PriceChangeSchema);
  }

  async init(): Promise<void> {
    await this.model.init();
  }

  async record(changes: PriceChangeInput[]): Promise<void> {
    if (!changes.length) return;
    const now = new Date();
    await this.model.insertMany(changes.map((c) => ({ ...c, at: c.at ?? now })));
  }

  async list(query: PriceChangeQuery): Promise<{ items: PriceChangeView[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.host) filter.host = query.host;
    if (query.kind) filter.kind = query.kind;
    if (query.source) filter.source = query.source;
    if (query.from || query.to) {
      filter.at = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
    }
    if (query.q) {
      const re = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ productName: re }, { variantLabel: re }, { sku: re }];
    }
    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ at: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return { items: docs.map(toView), total };
  }

  /** How many changes of each kind in the last `days` days, for the numbers above the table. */
  async summary(days: number, host?: string): Promise<{ total: number; byKind: Record<PriceKind, number>; products: number }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { at: { $gte: since }, ...(host ? { host } : {}) };
    const [kinds, products] = await Promise.all([
      this.model.aggregate<{ _id: PriceKind; n: number }>([{ $match: match }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
      this.model.aggregate<{ n: number }>([
        { $match: match },
        { $group: { _id: { host: '$host', productId: '$productId' } } },
        { $count: 'n' },
      ]),
    ]);
    const byKind = { price: 0, compareAtPrice: 0, cost: 0 } as Record<PriceKind, number>;
    for (const k of kinds) byKind[k._id] = k.n;
    return { total: kinds.reduce((sum, k) => sum + k.n, 0), byKind, products: products[0]?.n ?? 0 };
  }
}

function toView(doc: StoredPriceChange & { _id: Types.ObjectId }): PriceChangeView {
  const { _id, sku, variantLabel, userId, userName, userEmail, oldValue, newValue, ...rest } = doc as StoredPriceChange & {
    _id: Types.ObjectId;
    __v?: number;
  };
  delete (rest as { __v?: number }).__v;
  const both = oldValue !== null && oldValue !== undefined && newValue !== null && newValue !== undefined;
  const delta = both ? round2((newValue as number) - (oldValue as number)) : null;
  return {
    id: String(_id),
    ...rest,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    sku: sku ?? null,
    variantLabel: variantLabel ?? null,
    userId: userId ?? null,
    userName: userName ?? null,
    userEmail: userEmail ?? null,
    delta,
    deltaPercent: both && oldValue ? round2((((newValue as number) - (oldValue as number)) / (oldValue as number)) * 100) : null,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
