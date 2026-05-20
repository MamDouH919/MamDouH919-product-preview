import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true, type: LocalizedFieldSchema })
  name!: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  description?: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  shortDescription?: LocalizedField;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ required: false })
  price?: number;

  @Prop({ required: false })
  sku?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubCategory', required: false })
  subCategory?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  order!: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
