import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

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

  @Prop({ default: 0 })
  stock!: number;

  /** Total cost of the stock on hand (minor units). Unset until its cost is known. */
  @Prop({ type: Number, required: false })
  inventoryValueMinor?: number | null;

  /** Cost of one unit at the last receipt — what units sold short are estimated at. */
  @Prop({ type: Number, required: false })
  lastUnitCostMinor?: number | null;
}

export const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant);

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

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category', required: true })
  category!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'SubCategory', required: false })
  subCategory?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  slug!: string;

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
  // each variant and `totalStock` sums them.
  @Prop({ default: 0 })
  stock!: number;

  // Cost of `stock`, for a product without variants (variants carry their own).
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

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });
