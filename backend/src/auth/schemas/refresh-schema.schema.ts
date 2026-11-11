import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, SchemaTypes } from 'mongoose';

/**
 * One row per login session (device / browser). Its `_id` is the session id
 * carried in the access token as `sid`, so logging out deletes exactly this
 * session and leaves the user's other devices signed in.
 */
@Schema({ versionKey: false, timestamps: true })
export class RefreshToken extends Document {
  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, type: SchemaTypes.ObjectId })
  userId!: mongoose.Types.ObjectId;

  @Prop({ required: true })
  expiryDate!: Date;

  /**
   * The token this one replaced. Two tabs can hit 401 together and both
   * redeem the same token; the second must not fail just because the first
   * rotated it a moment earlier. Accepted until `previousValidUntil`.
   */
  @Prop()
  previousToken?: string;

  @Prop()
  previousValidUntil?: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
