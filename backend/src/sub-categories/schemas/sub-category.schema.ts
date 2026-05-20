import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

@Schema({ timestamps: true })
export class SubCategory extends Document {
  @Prop({ required: true, type: LocalizedFieldSchema })
  name!: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  description?: LocalizedField;

  @Prop({ required: false })
  image?: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category!: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  order!: number;
}

export const SubCategorySchema = SchemaFactory.createForClass(SubCategory);
