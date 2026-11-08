import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true, type: LocalizedFieldSchema })
  name!: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  description?: LocalizedField;

  @Prop({ required: false })
  image?: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ default: true })
  isActive!: boolean;

  /**
   * Google's product taxonomy for what's in this category — its numeric id
   * ("6552") or full path ("Arts & Entertainment > Party & Celebration").
   * Sent with every product in it in shopping feeds.
   */
  @Prop({ required: false })
  googleProductCategory?: string;

  @Prop({ default: 0 })
  order!: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
