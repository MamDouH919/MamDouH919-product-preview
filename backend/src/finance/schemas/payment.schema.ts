import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { PaymentMethod } from '../../orders/enums/order-status.enum';

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

  @Prop({ type: Date, required: false })
  voidedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  voidedBy?: Types.ObjectId;

  @Prop({ required: false })
  voidReason?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
