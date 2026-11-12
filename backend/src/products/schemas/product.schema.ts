import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

/** Units of one product or variant held in one warehouse. */
@Schema({ _id: false })
export class WarehouseStock {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Warehouse', required: true })
  warehouse!: Types.ObjectId;

  /** Only the main warehouse goes below zero: units sold ahead of a transfer (pre-orders). */
  @Prop({ default: 0 })
  qty!: number;
}

export const WarehouseStockSchema = SchemaFactory.createForClass(WarehouseStock);

/**
 * Units on hand across every warehouse — what the stock's value is the cost
 * of. Before warehouses existed there were no entries, and `stock` was all of it.
 */
export function totalUnits(source: { stock?: number; stocks?: WarehouseStock[] }): number {
  return source.stocks?.length ? source.stocks.reduce((t, s) => t + (s.qty ?? 0), 0) : (source.stock ?? 0);
}

/**
 * Units that can still be sold ahead of stock: what the other warehouses hold,
 * less what the main one already owes. Zero when nothing is elsewhere.
 */
export function preorderUnits(source: { stock?: number; stocks?: WarehouseStock[] }): number {
  return Math.max(0, totalUnits(source) - Math.max(source.stock ?? 0, 0));
}

// Variants carry their own `_id` so stock movements can reference one
// reliably — an array index would break the moment variants are reordered.
@Schema()
export class ProductVariant {
  _id!: Types.ObjectId;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: false })
  price?: number;

  @Prop({ required: false })
  sku?: string;

  /** The price before a discount, shown struck through. Unset or ≤ price: no sale. */
  @Prop({ type: Number, required: false })
  compareAtPrice?: number | null;

  /** Barcode (EAN/UPC/ISBN), for shopping feeds. Own-made goods have none. */
  @Prop({ required: false })
  gtin?: string;

  /** What sets this variant apart, for shopping feeds; free text in the store's language. */
  @Prop({ required: false })
  color?: string;

  @Prop({ required: false })
  size?: string;

  /** Units in the main warehouse — what can be sold now. Mirrors its entry in `stocks`. */
  @Prop({ default: 0 })
  stock!: number;

  /** Units per warehouse. Written only by InventoryService. */
  @Prop({ type: [WarehouseStockSchema], default: [] })
  stocks!: WarehouseStock[];

  /** Total cost of the stock on hand in every warehouse (minor units). Unset until its cost is known. */
  @Prop({ type: Number, required: false })
  inventoryValueMinor?: number | null;

  /** Cost of one unit at the last receipt — what units sold short are estimated at. */
  @Prop({ type: Number, required: false })
  lastUnitCostMinor?: number | null;
}

export const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant);

ProductVariantSchema.virtual('preorderStock').get(function (this: ProductVariant) {
  return preorderUnits(this);
});
ProductVariantSchema.set('toJSON', { virtuals: true });
ProductVariantSchema.set('toObject', { virtuals: true });

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true, type: LocalizedFieldSchema })
  name!: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  description?: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  shortDescription?: LocalizedField;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ required: false })
  price?: number;

  @Prop({ required: false })
  sku?: string;

  /** The price before a discount, shown struck through. Unset or ≤ price: no sale. */
  @Prop({ type: Number, required: false })
  compareAtPrice?: number | null;

  /** Who makes it. Empty means the store itself (its name is used in feeds). */
  @Prop({ required: false })
  brand?: string;

  /** Barcode (EAN/UPC/ISBN), for shopping feeds. Own-made goods have none. */
  @Prop({ required: false })
  gtin?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category', required: true })
  category!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'SubCategory', required: false })
  subCategory?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  slug!: string;

  /**
   * Slugs this product had before, so links to them still find it and the
   * storefront can redirect to `slug` (a 308) instead of a 404.
   */
  @Prop({ type: [String], default: [], index: true })
  previousSlugs!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants!: ProductVariant[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  order!: number;

  // ── Inventory ──────────────────────────────────────────────────────────────
  // `false` means this product is never out of stock and orders never check it.
  @Prop({ default: true })
  trackStock!: boolean;

  // Only used when the product has no variants. With variants, stock lives on
  // each variant and `totalStock` sums them. Units in the main warehouse — what
  // can be sold now; `stocks` has every warehouse, the main one included.
  @Prop({ default: 0 })
  stock!: number;

  @Prop({ type: [WarehouseStockSchema], default: [] })
  stocks!: WarehouseStock[];

  // Cost of the units in every warehouse, for a product without variants (variants carry their own).
  // Changed only by InventoryService, with the stock, so the two always agree.
  @Prop({ type: Number, required: false })
  inventoryValueMinor?: number | null;

  @Prop({ type: Number, required: false })
  lastUnitCostMinor?: number | null;

  @Prop({ default: 0 })
  lowStockThreshold!: number;

  // Lets stock go negative instead of rejecting the sale.
  @Prop({ default: false })
  allowBackorder!: boolean;
  @Prop({ default: 0 })
  views!: number;

  @Prop({ default: 0 })
  whatsappClicks!: number;

  // ── Reviews ────────────────────────────────────────────────────────────────
  // Maintained by ReviewsService from approved reviews only; never edited here.
  @Prop({ default: 0 })
  ratingAverage!: number;

  @Prop({ default: 0 })
  ratingCount!: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

/** Stock across the whole product, wherever it happens to live. */
ProductSchema.virtual('totalStock').get(function (this: Product) {
  if (this.variants?.length) {
    return this.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  }
  return this.stock ?? 0;
});

/** Units that can be pre-ordered: held in other warehouses and not yet promised. */
ProductSchema.virtual('preorderStock').get(function (this: Product) {
  if (this.variants?.length) return this.variants.reduce((sum, v) => sum + preorderUnits(v), 0);
  return preorderUnits(this);
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });
