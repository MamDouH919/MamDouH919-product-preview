import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

/**
 * How many live orders one customer holds with one coupon. Exists so the
 * per-customer limit is claimed by a write: two checkouts by the same
 * customer racing for their last use both hit this one document, so only
 * one of them can win — a count of their orders could be read as 0 by both.
 */
@Schema({ versionKey: false })
export class CouponUsage extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Coupon', required: true })
  coupon!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true })
  customer!: Types.ObjectId;

  @Prop({ required: true, min: 0, default: 0 })
  count!: number;
}

export const CouponUsageSchema = SchemaFactory.createForClass(CouponUsage);
CouponUsageSchema.index({ coupon: 1, customer: 1 }, { unique: true });
