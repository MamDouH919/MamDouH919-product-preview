import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { PaymentMethod } from '../../orders/enums/order-status.enum';

/** Where giving an online payment back to the customer stands. */
export enum GatewayRefundState {
  /** The order was cancelled; the money has not been sent back yet. */
  PENDING = 'pending',
  /** The gateway is being asked right now. A crash here leaves it so: staff must check the gateway before retrying. */
  PROCESSING = 'processing',
  /** The gateway refused or was unreachable; safe to retry. */
  FAILED = 'failed',
  DONE = 'done',
}

export enum CollectionStatus {
  /** The money was received from the customer. */
  COLLECTED = 'collected',
  /** Recorded by mistake and reversed. Kept, never deleted. */
  VOIDED = 'voided',
}

/** Who holds the money right after it was collected. */
export enum Custody {
  /** Staff took it straight into the store's cash. */
  STORE = 'store',
  /** A courier holds it until they hand it over (a settlement). */
  COURIER = 'courier',
  /** An online payment: the payment gateway holds it until it pays the store out. */
  GATEWAY = 'gateway',
}

/**
 * Money received from a customer against an order. Separate from the order's
 * status: an order can be delivered and still unpaid, or paid in parts.
 */
@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ required: true, unique: true })
  paymentNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true, index: true })
  order!: Types.ObjectId;

  @Prop({ required: true })
  orderNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true })
  customer!: Types.ObjectId;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  method!: PaymentMethod;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ type: String, enum: CollectionStatus, default: CollectionStatus.COLLECTED, index: true })
  status!: CollectionStatus;

  @Prop({ type: String, enum: Custody, required: true })
  custody!: Custody;

  /** When the customer paid — the date the collection reports in. */
  @Prop({ type: Date, required: true })
  collectedAt!: Date;

  /** The courier holding it, when `custody` is courier. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Courier', required: false, index: true })
  courier?: Types.ObjectId;

  /** The settlement in which the courier handed it over. Unset while they still hold it. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CourierSettlement', required: false })
  settlement?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  recordedBy?: Types.ObjectId;

  @Prop({ required: false })
  note?: string;

  /** Online payments: which gateway took it, and its id for the transaction (a refund needs it). */
  @Prop({ required: false })
  provider?: string;

  @Prop({ required: false })
  providerTransactionId?: string;

  /**
   * True while the money sits in customer deposits because the order was not
   * delivered yet; delivery moves it against the receivable and clears this.
   */
  @Prop({ default: false })
  heldAsDeposit?: boolean;

  /** Online payments given back after a cancellation. Unset while nothing is being refunded. */
  @Prop({ type: String, enum: GatewayRefundState, required: false, index: true })
  refundState?: GatewayRefundState;

  @Prop({ required: false })
  refundNote?: string;

  @Prop({ type: Date, required: false })
  refundedAt?: Date;

  @Prop({ type: Date, required: false })
  voidedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  voidedBy?: Types.ObjectId;

  @Prop({ required: false })
  voidReason?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
// One gateway transaction books one payment, however often its webhook arrives.
PaymentSchema.index(
  { provider: 1, providerTransactionId: 1 },
  { unique: true, partialFilterExpression: { providerTransactionId: { $type: 'string' } } },
);
