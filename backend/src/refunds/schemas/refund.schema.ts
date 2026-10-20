import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export enum RefundStatus {
  /** Asked for; waiting for an approver. */
  REQUESTED = 'requested',
  /** Approved (by a person, or automatically under the store's threshold); not paid out yet. */
  APPROVED = 'approved',
  /** Turned down. Final. */
  REJECTED = 'rejected',
  /** Money given back and posted to the books. */
  EXECUTED = 'executed',
  /** An executed refund undone by a reversing entry — it was recorded by mistake. Final. */
  REVERSED = 'reversed',
}

/** How the money goes back. */
export enum RefundMethod {
  /** The store pays the customer from its cash. */
  CASH = 'cash',
  /** A courier pays the customer out of the cash they hold for the store. */
  COURIER_CASH = 'courier_cash',
  /** Taken off what the customer still owes — nothing is paid out. */
  CREDIT_AGAINST_RECEIVABLE = 'credit_against_receivable',
}

export enum RefundReason {
  DAMAGED = 'damaged',
  WRONG_ITEM = 'wrong_item',
  NOT_AS_DESCRIBED = 'not_as_described',
  CHANGED_MIND = 'changed_mind',
  LATE_DELIVERY = 'late_delivery',
  GOODWILL = 'goodwill',
  OTHER = 'other',
}

/** Reasons that are the store's fault — what the delivery-fee policy asks about. */
export const STORE_FAULT_REASONS: RefundReason[] = [
  RefundReason.DAMAGED,
  RefundReason.WRONG_ITEM,
  RefundReason.NOT_AS_DESCRIBED,
  RefundReason.LATE_DELIVERY,
];

/** The product part of a refund, per order line. */
@Schema({ _id: false })
export class RefundLine {
  /** Position of the line in `order.items`. */
  @Prop({ required: true, min: 0 })
  lineIndex!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: false })
  variantId?: Types.ObjectId;

  /** Units coming back. 0 for an allowance on a line nothing was returned from. */
  @Prop({ required: true, min: 0 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  amountMinor!: number;

  /** Whether the units should go back on the shelf when the refund is paid out. */
  @Prop({ default: false })
  restock!: boolean;

  /** Whether they did — false for a product that no longer tracks stock. */
  @Prop({ default: false })
  restocked!: boolean;
}

export const RefundLineSchema = SchemaFactory.createForClass(RefundLine);

@Schema({ _id: false })
export class RefundChange {
  @Prop({ type: String, enum: RefundStatus, required: true })
  status!: RefundStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  by?: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ required: false })
  note?: string;
}

export const RefundChangeSchema = SchemaFactory.createForClass(RefundChange);

/**
 * Money given back on one order — its own record, with its own date, amount,
 * method, reason and the people who asked, approved and paid it. Only
 * execution moves money: it posts to the books dated when it happened, so the
 * refund reports in its own period while the sale stays in its own.
 */
@Schema({ timestamps: true })
export class Refund extends Document {
  @Prop({ required: true, unique: true })
  refundNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true, index: true })
  order!: Types.ObjectId;

  @Prop({ required: true })
  orderNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true })
  customer!: Types.ObjectId;

  /** The return the goods came back on, when there was one. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ReturnRequest', required: false, index: true })
  returnRequest?: Types.ObjectId;

  @Prop({ required: false })
  returnNumber?: number;

  @Prop({ type: [RefundLineSchema], default: [] })
  lines!: RefundLine[];

  @Prop({ required: true, min: 0 })
  productMinor!: number;

  @Prop({ required: true, min: 0 })
  deliveryMinor!: number;

  @Prop({ required: true, min: 1 })
  totalMinor!: number;

  @Prop({ type: String, enum: RefundMethod, required: true })
  method!: RefundMethod;

  @Prop({ type: String, enum: RefundReason, required: true })
  reason!: RefundReason;

  /** The courier who pays it out, for `courier_cash`: it comes off the cash they hold for the store. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Courier', required: false, index: true })
  courier?: Types.ObjectId;

  /** For `cash`: the cash box, bank or wallet it is paid from. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'MoneyAccount', required: false })
  moneyAccount?: Types.ObjectId;

  /** The settlement that accounted for that cash. Unset until the courier settles. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CourierSettlement', required: false })
  settlement?: Types.ObjectId;

  @Prop({ required: false })
  note?: string;

  @Prop({ type: String, enum: RefundStatus, default: RefundStatus.REQUESTED, index: true })
  status!: RefundStatus;

  /** Approved on request because it was under the store's threshold and within policy. */
  @Prop({ default: false })
  autoApproved!: boolean;

  /** Gives back more of the delivery fee than the store's policy allows — so it can't be auto-approved. */
  @Prop({ default: false })
  beyondPolicy!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  requestedBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  approvedBy?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  executedBy?: Types.ObjectId;

  /** When the money went back — the date the refund reports in. */
  @Prop({ type: Date, required: false })
  executedAt?: Date;

  @Prop({ type: [RefundChangeSchema], default: [] })
  history!: RefundChange[];
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
RefundSchema.index({ createdAt: -1 });
