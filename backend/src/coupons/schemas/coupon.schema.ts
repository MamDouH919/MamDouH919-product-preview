import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum CouponType {
  /** `value` is a percentage of the subtotal, optionally capped by `maxDiscount`. */
  PERCENTAGE = 'percentage',
  /** `value` is a fixed amount off, never more than the subtotal. */
  FIXED = 'fixed',
}

@Schema({ timestamps: true })
export class Coupon extends Document {
  /** Stored upper-case so "summer10" and "SUMMER10" are the same code. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ type: String, enum: CouponType, required: true })
  type!: CouponType;

  @Prop({ required: true, min: 0 })
  value!: number;

  /** Smallest subtotal the coupon applies to. */
  @Prop({ required: false, min: 0 })
  minSubtotal?: number;

  /** Upper bound on a percentage discount. */
  @Prop({ required: false, min: 0 })
  maxDiscount?: number;

  @Prop({ type: Date, required: false })
  startsAt?: Date;

  @Prop({ type: Date, required: false })
  expiresAt?: Date;

  /** Total redemptions allowed across all customers; unlimited when absent. */
  @Prop({ required: false, min: 1 })
  usageLimit?: number;

  /** Redemptions allowed per customer; unlimited when absent. */
  @Prop({ required: false, min: 1 })
  perCustomerLimit?: number;

  /** Orders currently holding this coupon. Goes back down when one is cancelled. */
  @Prop({ default: 0, min: 0 })
  usedCount!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
