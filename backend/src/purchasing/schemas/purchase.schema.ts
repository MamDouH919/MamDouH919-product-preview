import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

export enum PurchaseStatus {
  /** Being entered; nothing has moved. Can be edited or deleted. */
  DRAFT = 'draft',
  /** Goods received into stock and the supplier owed. Fixed from here: corrections are purchase returns. */
  POSTED = 'posted',
}

/** One product (or variant) bought. Amounts are minor units. */
@Schema({ _id: false })
export class PurchaseLine {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: false })
  variantId?: Types.ObjectId;

  /** A copy of the name as it was bought, like an order line's. */
  @Prop({ type: LocalizedFieldSchema, required: true })
  name!: LocalizedField;

  @Prop({ required: false })
  variantLabel?: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  /** Price per unit on the supplier's invoice. */
  @Prop({ required: true, min: 0 })
  unitCostMinor!: number;

  /** This line's share of freight and other costs of getting the goods in, split by value. */
  @Prop({ default: 0, min: 0 })
  landedMinor!: number;

  /** What the units cost the store: quantity × unit cost + landed share. What goes into stock. */
  @Prop({ default: 0, min: 0 })
  valueMinor!: number;

  @Prop({ default: 0, min: 0 })
  returnedQty!: number;

  @Prop({ default: 0, min: 0 })
  returnedMinor!: number;
}

export const PurchaseLineSchema = SchemaFactory.createForClass(PurchaseLine);

/**
 * Goods received from a supplier. Posting it puts the units into stock at
 * their cost and records what the store owes; paying and returning reduce that.
 */
@Schema({ timestamps: true })
export class Purchase extends Document {
  @Prop({ required: true, unique: true })
  purchaseNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Supplier', required: true, index: true })
  supplier!: Types.ObjectId;

  /** The supplier's own invoice number, to match their statement. */
  @Prop({ required: false, trim: true })
  supplierInvoiceNo?: string;

  /** When the goods were received — the date the purchase reports in. */
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Date, required: false })
  dueDate?: Date;

  @Prop({ type: [PurchaseLineSchema], default: [] })
  lines!: PurchaseLine[];

  /** Freight, customs and the like, spread over the lines when posted. */
  @Prop({ default: 0, min: 0 })
  landedCostMinor!: number;

  /** Σ quantity × unit cost. */
  @Prop({ default: 0, min: 0 })
  subtotalMinor!: number;

  /** Subtotal + landed cost — what the supplier is owed. */
  @Prop({ default: 0, min: 0 })
  totalMinor!: number;

  @Prop({ default: 0, min: 0 })
  paidMinor!: number;

  @Prop({ default: 0, min: 0 })
  returnedMinor!: number;

  @Prop({ type: String, enum: PurchaseStatus, default: PurchaseStatus.DRAFT, index: true })
  status!: PurchaseStatus;

  @Prop({ required: false })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  postedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  postedAt?: Date;
}

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);
PurchaseSchema.index({ date: -1 });
