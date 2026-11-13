import type { PriceChangeDraft } from '../common/tenant/price-change-recorder';
import type { PriceSource } from '../common/tenant/price-change-store';

/** The parts of a product (or one of its variants) that carry a price. */
interface Priced {
  _id?: unknown;
  label?: string;
  price?: number | null;
  compareAtPrice?: number | null;
}

interface PricedProduct extends Priced {
  _id?: unknown;
  name?: { en?: string; ar?: string } | null;
  sku?: string;
  variants?: Priced[];
}

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function entries(item: Priced): { kind: 'price' | 'compareAtPrice'; value: number | null }[] {
  return [
    { kind: 'price', value: num(item.price) },
    { kind: 'compareAtPrice', value: num(item.compareAtPrice) },
  ];
}

/**
 * The selling-price changes between two states of one product — its own and
 * each variant's, matched by id. `before` left out means the product is new,
 * so every price it starts with counts. Unchanged prices, and a new product's
 * missing ones, produce nothing.
 */
export function diffProductPrices(
  before: PricedProduct | null,
  after: PricedProduct,
  source: PriceSource,
): PriceChangeDraft[] {
  const productName = after.name?.en || after.name?.ar || 'Product';
  const base = { productId: String(after._id), productName, ...(after.sku ? { sku: after.sku } : {}), source };
  const out: PriceChangeDraft[] = [];

  const compare = (oldItem: Priced | undefined, newItem: Priced, variantLabel?: string) => {
    const was = oldItem ? entries(oldItem) : entries({});
    for (const { kind, value } of entries(newItem)) {
      const old = was.find((e) => e.kind === kind)!.value;
      if (old === value) continue;
      out.push({ ...base, kind, ...(variantLabel ? { variantLabel } : {}), oldValue: old, newValue: value });
    }
  };

  compare(before ?? undefined, after);
  for (const variant of after.variants ?? []) {
    const previous = before?.variants?.find((v) => String(v._id) === String(variant._id));
    // A variant that didn't exist before starts at no price, like a new product.
    compare(previous, variant, variant.label);
  }
  return out;
}
