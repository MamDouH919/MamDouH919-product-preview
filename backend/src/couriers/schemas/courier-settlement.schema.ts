import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

/**
 * A courier handing over the COD cash they hold. Covers everything they held
 * at the time: what they collected, less refunds they paid customers in cash
 * and the fee they keep. Whatever doesn't match what they hand over is the
 * difference, recorded with its reason. Amounts are minor units.
 */
@Schema({ timestamps: true })
export class CourierSettlement extends Document {
  @Prop({ required: true, unique: true })
  settlementNumber!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Courier', required: true, index: true })
  courier!: Types.ObjectId;

  /** When the cash was handed over — the date it reports in. */
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Payment', default: [] })
  payments!: Types.ObjectId[];

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Refund', default: [] })
  refunds!: Types.ObjectId[];

  /** What the courier collected from customers. */
  @Prop({ required: true, min: 0 })
  collectedMinor!: number;

  /** What they paid back to customers as refunds, out of that cash. */
  @Prop({ default: 0, min: 0 })
  refundsPaidMinor!: number;

  /** What they keep for delivering — a delivery cost to the store. */
  @Prop({ default: 0, min: 0 })
  feesMinor!: number;

  /** collected − refunds paid − fees: what they should hand over. */
  @Prop({ required: true, min: 0 })
  expectedMinor!: number;

  /** What they actually handed over. */
  @Prop({ required: true, min: 0 })
  receivedMinor!: number;

  /** received − expected. Negative: short; positive: over. Posted to cash over/short. */
  @Prop({ default: 0 })
  differenceMinor!: number;

  @Prop({ required: false })
  differenceReason?: string;

  @Prop({ required: false })
  note?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const CourierSettlementSchema = SchemaFactory.createForClass(CourierSettlement);
