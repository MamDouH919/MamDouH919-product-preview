import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export enum PayoutStatus {
  POSTED = 'posted',
  /** Recorded by mistake and undone by a reversing entry. */
  REVERSED = 'reversed',
}

/**
 * Money the payment gateway paid out to the store's bank, with what it kept
 * as fees. Recording one moves it off the gateway's balance in the books:
 * the bank gets `netMinor`, fees are an expense, and `grossMinor` leaves
 * "Online payments held by the gateway".
 */
@Schema({ timestamps: true })
export class GatewayPayout extends Document {
  @Prop({ required: true, unique: true })
  payoutNumber!: number;

  /** The day the money reached the bank — the date the entry reports in. */
  @Prop({ type: Date, required: true })
  date!: Date;

  /** What the gateway released, before its fees. */
  @Prop({ required: true, min: 1 })
  grossMinor!: number;

  @Prop({ required: true, min: 0, default: 0 })
  feeMinor!: number;

  /** What reached the bank: gross less fees. */
  @Prop({ required: true, min: 0 })
  netMinor!: number;

  /** The bank (or wallet) it landed in. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'MoneyAccount', required: true })
  moneyAccount!: Types.ObjectId;

  /** The gateway's own settlement number, to find it in its dashboard. */
  @Prop({ required: false })
  reference?: string;

  @Prop({ required: false })
  note?: string;

  @Prop({ type: String, enum: PayoutStatus, default: PayoutStatus.POSTED, index: true })
  status!: PayoutStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  reversedAt?: Date;

  @Prop({ required: false })
  reversalReason?: string;
}

export const GatewayPayoutSchema = SchemaFactory.createForClass(GatewayPayout);
GatewayPayoutSchema.index({ date: -1 });
