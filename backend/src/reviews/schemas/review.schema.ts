import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export enum ReviewStatus {
  /** Written by the customer, not yet seen by the store. Not public. */
  PENDING = 'pending',
  /** Public, and counted in the product's rating. */
  APPROVED = 'approved',
  /** Kept for the record but never shown. */
  REJECTED = 'rejected',
}

/**
 * A customer's rating of a product they received. One per customer per
 * product — a second opinion edits the first rather than stacking up.
 */
@Schema({ timestamps: true })
export class Review extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true, index: true })
  customer!: Types.ObjectId;

  /**
   * What the storefront shows as the author ("Sara A."), worked out once when
   * the review is written so the customer's full name is never public.
   */
  @Prop({ required: true })
  authorName!: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: false })
  comment?: string;

  @Prop({ type: String, enum: ReviewStatus, default: ReviewStatus.PENDING, index: true })
  status!: ReviewStatus;

  /** The store's public answer, shown under the review. */
  @Prop({ required: false })
  reply?: string;

  @Prop({ type: Date, required: false })
  repliedAt?: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ product: 1, customer: 1 }, { unique: true });
ReviewSchema.index({ product: 1, status: 1, createdAt: -1 });
