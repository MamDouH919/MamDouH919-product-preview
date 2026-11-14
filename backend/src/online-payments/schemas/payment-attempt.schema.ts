import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export enum AttemptStatus {
  /** A checkout was opened; the customer has not paid yet. */
  PENDING = 'pending',
  /** The gateway confirmed the money; the payment is booked. */
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  /**
   * The gateway took money the order could not accept (cancelled meanwhile,
   * or a different amount). Nothing is booked; staff sort it out.
   */
  NEEDS_REVIEW = 'needs_review',
  /** The order had been cancelled when the money arrived, so the gateway was told to send it straight back. */
  REFUNDED = 'refunded',
}

/**
 * One try at paying an order. An order can have several (a failed card, then
 * another); the gateway echoes `reference` back so its webhook finds this one.
 */
@Schema({ timestamps: true })
export class PaymentAttempt extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true, index: true })
  order!: Types.ObjectId;

  @Prop({ required: true })
  provider!: string;

  /** What the gateway echoes back to us. Unique per attempt. */
  @Prop({ required: true, unique: true })
  reference!: string;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ required: true })
  currencyCode!: string;

  @Prop({ type: String, enum: AttemptStatus, default: AttemptStatus.PENDING, index: true })
  status!: AttemptStatus;

  @Prop({ required: false })
  providerTransactionId?: string;

  @Prop({ required: false })
  note?: string;
}

export const PaymentAttemptSchema = SchemaFactory.createForClass(PaymentAttempt);
