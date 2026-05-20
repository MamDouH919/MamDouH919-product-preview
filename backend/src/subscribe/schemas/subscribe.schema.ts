import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Subscribe extends Document {
  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: false })
  jobTitle?: string;

  @Prop({ required: false })
  company?: string;

  @Prop({ required: false })
  city?: string;

  @Prop({ required: false })
  country?: string;

  @Prop({ type: [String], default: [] })
  practiceSubscriptions!: string[];

  @Prop({ type: [String], default: [] })
  sectorSubscriptions!: string[];

  @Prop({ default: false })
  lawUpdate!: boolean;

  @Prop({ default: false })
  events!: boolean;
}

export const SubscribeSchema = SchemaFactory.createForClass(Subscribe);
