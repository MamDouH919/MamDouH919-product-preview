import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Otp extends Document {
  @Prop({ required: true })
  email!: string;

  @Prop({ required: true })
  otp!: string;

  @Prop({ required: true, expires: 0 })
  expiryDate!: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
