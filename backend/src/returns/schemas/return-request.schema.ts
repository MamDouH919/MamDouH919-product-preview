import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

export enum ReturnStatus {
  /** Asked for by the customer; the store hasn't decided. */
  REQUESTED = 'requested',
  /** Accepted — the customer can send the items back. */
  APPROVED = 'approved',
  /** Turned down. Final. */
  REJECTED = 'rejected',
  /** Money given back (and, line by line, stock put back). Final. */
  REFUNDED = 'refunded',
}

export enum ReturnReason {
  DAMAGED = 'damaged',
  WRONG_ITEM = 'wrong_item',
  NOT_AS_DESCRIBED = 'not_as_described',
  CHANGED_MIND = 'changed_mind',
  OTHER = 'other',
}

/** Where a return may go next. Refunding straight from a request is allowed — the store's call. */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.REFUNDED],
  [ReturnStatus.APPROVED]: [ReturnStatus.REFUNDED, ReturnStatus.REJECTED],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.REFUNDED]: [],
};

/** A line being returned — a copy of the order line, like the order's own snapshot. */
@Schema({ _id: false })
export class ReturnItem {
  /** Position of the line in `order.items`, which is what ties the two together. */
  @Prop({ required: true })
  lineIndex!: number;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false })
  variantId?: Types.ObjectId;

  @Prop({ type: LocalizedFieldSchema, required: true })
  name!: LocalizedField;

  @Prop({ required: false })
  variantLabel?: string;

  @Prop({ required: false })
  image?: string;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  /** Put back on the shelf when refunded — false for damaged goods written off. */
  @Prop({ default: false })
  restocked!: boolean;
}
export const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

@Schema({ _id: false })
export class ReturnStatusChange {
  @Prop({ type: String, enum: ReturnStatus, required: true })
  status!: ReturnStatus;

  @Prop({ required: false })
  note?: string;

  /** The admin who made the change. Absent when the customer did it. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  by?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}
export const ReturnStatusChangeSchema = SchemaFactory.createForClass(ReturnStatusChange);

@Schema({ timestamps: true })
export class ReturnRequest extends Document {
  /** Sequential per tenant, like order numbers — "return #2003". */
  @Prop({ required: true, unique: true })
  returnNumber!: number;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order!: Types.ObjectId;

  @Prop({ required: true })
  orderNumber!: number;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customer!: Types.ObjectId;

  @Prop({ type: [ReturnItemSchema], required: true })
  items!: ReturnItem[];

  @Prop({ type: String, enum: ReturnReason, required: true })
  reason!: ReturnReason;

  /** What the customer (or the admin, for a return opened in the dashboard) wrote. */
  @Prop({ required: false })
  note?: string;

  @Prop({ type: String, enum: ReturnStatus, default: ReturnStatus.REQUESTED, index: true })
  status!: ReturnStatus;

  /** Who started it: the customer from their account, or the store for a phone or in-person return. */
  @Prop({ type: String, enum: ['customer', 'store'], required: true })
  openedBy!: 'customer' | 'store';

  @Prop({ required: false })
  refundAmount?: number;

  @Prop({ type: [ReturnStatusChangeSchema], default: [] })
  history!: ReturnStatusChange[];
}

export const ReturnRequestSchema = SchemaFactory.createForClass(ReturnRequest);
ReturnRequestSchema.index({ createdAt: -1 });
