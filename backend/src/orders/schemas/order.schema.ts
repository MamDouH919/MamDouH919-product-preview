import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';
import { OrderPaymentStatus, OrderStatus, PaymentMethod } from '../enums/order-status.enum';

/**
 * One line of an order. Everything a receipt shows is copied in at the moment
 * of purchase — renaming a product, changing its price or deleting it later
 * must not rewrite what the customer actually bought.
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: false })
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

  // Minor units (piastres) — what the books use. The plain fields above are
  // the same amounts in pounds, kept for the screens and emails that read them.
  // Absent only on lines written before the books existed.

  @Prop({ required: false })
  unitPriceMinor?: number;

  @Prop({ required: false })
  lineTotalMinor?: number;

  /** This line's share of the order discount, so line totals net of discount add up exactly. */
  @Prop({ required: false })
  discountMinor?: number;

  /**
   * What the units cost when they were taken off the shelf (minor units), and
   * what it reaches the books as on delivery. Unset when the stock had no
   * cost yet — the line is then reported as uncosted.
   */
  @Prop({ type: Number, required: false })
  costMinor?: number;

  /** Some units were sold short and costed at an estimate. */
  @Prop({ default: false })
  costEstimated!: boolean;

  /** Cost already put back on the shelf by refunds that restocked units of this line. */
  @Prop({ default: 0 })
  costReturnedMinor!: number;

  /** Units of this line refunded so far, and the money given back for it. */
  @Prop({ default: 0, min: 0 })
  refundedQty!: number;

  @Prop({ default: 0, min: 0 })
  refundedMinor!: number;

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

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Zone', required: false })
  zone?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'SubZone', required: false })
  subZone?: Types.ObjectId;

  @Prop({ type: LocalizedFieldSchema, required: false })
  zoneName?: LocalizedField;

  @Prop({ type: LocalizedFieldSchema, required: false })
  subZoneName?: LocalizedField;

  /** Only on orders placed before the price list existed. */
  @Prop({ required: false })
  city?: string;

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
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  by?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}

export const OrderStatusChangeSchema = SchemaFactory.createForClass(OrderStatusChange);

/** The coupon as it stood when the order was placed. */
@Schema({ _id: false })
export class AppliedCoupon {
  /** The coupon itself, so giving a use back finds this coupon and not a later one with the same code. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Coupon', required: false })
  id?: Types.ObjectId;

  @Prop({ required: true })
  code!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  value!: number;
}

export const AppliedCouponSchema = SchemaFactory.createForClass(AppliedCoupon);

/**
 * What has happened to the order's money, in minor units. Kept in step with
 * the payments and the journal in the same transaction; what is still owed is
 * derived from it, never stored.
 */
@Schema({ _id: false })
export class OrderMoney {
  @Prop({ default: 0, min: 0 })
  collectedMinor!: number;

  /** Every executed refund, whatever its method. Never more than the total. */
  @Prop({ default: 0, min: 0 })
  refundedMinor!: number;

  /** Refunds paid out in cash (by the store or a courier). Never more than was collected. */
  @Prop({ default: 0, min: 0 })
  cashRefundedMinor!: number;

  /** Refunds taken off what the customer still owed instead of paid out. */
  @Prop({ default: 0, min: 0 })
  creditedMinor!: number;

  /** The delivery-fee part of the refunds. */
  @Prop({ default: 0, min: 0 })
  deliveryRefundedMinor!: number;

  /** What the customer owed and never paid, written off as uncollectible. */
  @Prop({ default: 0, min: 0 })
  writtenOffMinor!: number;
}

export const OrderMoneySchema = SchemaFactory.createForClass(OrderMoney);

@Schema({ timestamps: true })
export class Order extends Document {
  /** Human-facing, sequential per tenant — what a customer reads out on the phone. */
  @Prop({ required: true, unique: true })
  orderNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true, index: true })
  customer!: Types.ObjectId;

  /**
   * Set on guest orders: the secret in the confirmation link that lets the
   * shopper see the order without signing in.
   */
  @Prop({ required: false, index: true })
  guestToken?: string;

  /**
   * True when this guest order is what created the customer record — the
   * shopper holding its token may then set a password straight away. Cleared
   * once used. A record that existed before can only be activated by email,
   * or anyone who knew an address could take over its order history.
   */
  @Prop({ default: false })
  canClaimAccount!: boolean;

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

  @Prop({ required: false })
  subtotalMinor?: number;

  @Prop({ required: false })
  discountMinor?: number;

  @Prop({ required: false })
  shippingFeeMinor?: number;

  /** Always 0 until the store's Super Admin turns tax on. */
  @Prop({ required: false })
  taxMinor?: number;

  @Prop({ required: false })
  totalMinor?: number;

  /** ISO 4217 code every amount on this order is in. */
  @Prop({ required: false })
  currencyCode?: string;

  @Prop({ type: Date, required: false })
  deliveredAt?: Date;

  @Prop({ type: Date, required: false })
  cancelledAt?: Date;

  /** When the sale was posted to the books (on delivery). Absent for orders outside them. */
  @Prop({ type: Date, required: false })
  bookedAt?: Date;

  @Prop({ type: String, enum: OrderPaymentStatus, default: OrderPaymentStatus.UNPAID, index: true })
  paymentStatus!: OrderPaymentStatus;

  @Prop({ type: OrderMoneySchema, default: () => ({}) })
  money!: OrderMoney;

  /** Money given back through refunded returns. Never more than `total`. */
  @Prop({ default: 0 })
  refundedTotal!: number;

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
OrderSchema.index({ deliveredAt: -1 });
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ 'coupon.code': 1, customer: 1 });
