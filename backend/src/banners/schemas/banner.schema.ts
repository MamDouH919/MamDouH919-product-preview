import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';

@Schema({ timestamps: true })
export class Banner extends Document {
  @Prop({ required: true })
  image?: string;

  /** Optional art-directed image for phones; the slider falls back to `image`. */
  @Prop({ required: false })
  mobileImage?: string;

  /** Seconds of `image` when it is a video (max 30); 0 / unset for a photo. */
  @Prop({ required: false })
  duration?: number;

  /** Seconds of `mobileImage` when it is a video (max 30); 0 / unset for a photo. */
  @Prop({ required: false })
  mobileDuration?: number;

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
