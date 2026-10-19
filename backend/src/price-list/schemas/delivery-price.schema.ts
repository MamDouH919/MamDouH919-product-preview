import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

/**
 * One row of the price list: the store delivers to this subzone for this much.
 * A subzone with no row (or an inactive one) can't be chosen at checkout.
 */
@Schema({ timestamps: true })
export class DeliveryPrice extends Document {
  /** Copied from the subzone, so the list can be filtered by zone without a join. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Zone', required: true, index: true })
  zone!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'SubZone', required: true, unique: true })
  subZone!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const DeliveryPriceSchema = SchemaFactory.createForClass(DeliveryPrice);
