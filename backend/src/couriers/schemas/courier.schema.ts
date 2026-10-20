import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum CourierType {
  /** The store's own delivery staff. */
  IN_HOUSE = 'in_house',
  /** A delivery company. */
  COMPANY = 'company',
}

/** Someone who delivers orders and may hold the store's COD cash until they settle. */
@Schema({ timestamps: true })
export class Courier extends Document {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: CourierType, default: CourierType.IN_HOUSE })
  type!: CourierType;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CourierSchema = SchemaFactory.createForClass(Courier);
