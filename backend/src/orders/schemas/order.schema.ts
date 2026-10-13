import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';
import { OrderStatus, PaymentMethod } from '../enums/order-status.enum';

/**
 * One line of an order. Everything a receipt shows is copied in at the moment
 * of purchase — renaming a product, changing its price or deleting it later
 * must not rewrite what the customer actually bought.
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: false })
  variantId?: Types.ObjectId;

  @Prop({ type: LocalizedFieldSchema, required: true })
  name!: LocalizedField;

  @Prop({ required: false })
  variantLabel?: string;

  @Prop({ required: false })
  sku?: string;

  @Prop({ required: false })
  image?: string;

  @Prop({ required: false })
  slug?: string;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  lineTotal!: number;

  /**
   * Whether placing the order took this line out of stock. Cancelling only
   * returns what was actually taken, even if the product's tracking setting
   * has changed since.
   */
  @Prop({ default: false })
  stockDeducted!: boolean;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

/** A copy of the address the order ships to, not a reference to the address book. */
@Schema({ _id: false })
export class ShippingAddress {
  @Prop({ required: true })
  fullName!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: false })
  area?: string;

  @Prop({ required: true })
  street!: string;

  @Prop({ required: false })
  building?: string;

  @Prop({ required: false })
  notes?: string;
}

export const ShippingAddressSchema = SchemaFactory.createForClass(ShippingAddress);

@Schema({ _id: false })
export class OrderStatusChange {
  @Prop({ type: String, enum: OrderStatus, required: true })
  status!: OrderStatus;

  @Prop({ required: false })
  note?: string;

  /** The admin who made the change. Absent when the customer did it. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  by?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}

export const OrderStatusChangeSchema = SchemaFactory.createForClass(OrderStatusChange);

/** The coupon as it stood when the order was placed. */
@Schema({ _id: false })
export class AppliedCoupon {
  @Prop({ required: true })
  code!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  value!: number;
}

export const AppliedCouponSchema = SchemaFactory.createForClass(AppliedCoupon);

@Schema({ timestamps: true })
export class Order extends Document {
  /** Human-facing, sequential per tenant — what a customer reads out on the phone. */
  @Prop({ required: true, unique: true })
  orderNumber!: number;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true, index: true })
  customer!: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ type: ShippingAddressSchema, required: true })
  shippingAddress!: ShippingAddress;

  @Prop({ required: true })
  subtotal!: number;

  /** Coupon discount taken off the subtotal. */
  @Prop({ default: 0 })
  discount!: number;

  @Prop({ type: AppliedCouponSchema, required: false })
  coupon?: AppliedCoupon;

  @Prop({ default: 0 })
  shippingFee!: number;

  @Prop({ required: true })
  total!: number;

  /** The store's currency when the order was placed. */
  @Prop({ type: LocalizedFieldSchema, required: false })
  currency?: LocalizedField;

  @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.CASH_ON_DELIVERY })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING, index: true })
  status!: OrderStatus;

  @Prop({ type: [OrderStatusChangeSchema], default: [] })
  statusHistory!: OrderStatusChange[];

  /** What the customer wrote at checkout. */
  @Prop({ required: false })
  notes?: string;

  /** Storefront language at checkout — the language order emails are sent in. */
  @Prop({ required: false })
  locale?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ 'coupon.code': 1, customer: 1 });
