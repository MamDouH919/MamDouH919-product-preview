import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, SchemaTypes } from 'mongoose';

@Schema({ versionKey: false, timestamps: true })

export class RefreshToken extends Document {
  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, type: SchemaTypes.ObjectId })
  userId!: mongoose.Types.ObjectId;

  @Prop({ required: true })
  expiryDate!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);