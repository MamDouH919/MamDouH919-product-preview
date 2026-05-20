import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

@Schema({ timestamps: true })
export class Banner extends Document {
  @Prop({ required: true })
  image?: string;

  @Prop({ required: true, type: LocalizedFieldSchema })
  title!: LocalizedField;

  @Prop({ required: false, type: LocalizedFieldSchema })
  description?: LocalizedField;

  @Prop({ default: true })
  active!: boolean;

  @Prop({ default: 0 })
  weight!: number;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
