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

  @Prop({ default: 0 })
  order!: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
