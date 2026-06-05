import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

export class SocialMediaItem {
  key!: string;
  value!: string;
}

@Schema({ timestamps: true })
export class Setting extends Document {
  @Prop({ type: LocalizedFieldSchema, required: false })
  siteTitle?: LocalizedField;

  @Prop({ type: LocalizedFieldSchema, required: false })
  siteDescription?: LocalizedField;

  @Prop({ required: false })
  logo?: string;

  @Prop({ required: false })
  favicon?: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  whatsapp?: string;

  @Prop({ required: false })
  landLine?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ required: false })
  address?: string;

  @Prop({
    type: [{ key: String, value: String }],
    default: [],
  })
  socialMedia!: SocialMediaItem[];

  @Prop({ default: '#1976d2' })
  primaryColor?: string;

  @Prop({ type: LocalizedFieldSchema, required: false })
  currency?: LocalizedField;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
