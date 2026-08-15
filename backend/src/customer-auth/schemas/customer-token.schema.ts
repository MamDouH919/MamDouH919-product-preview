import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Customers get their own token collections rather than sharing the admin
 * ones. `POST /auth/refresh` looks a refresh token up by its string alone and
 * then mints an admin access token for whatever id it finds — so a customer
 * token sitting in that collection would be redeemable for admin access.
 * Separate collections make that impossible rather than merely unlikely.
 */
@Schema({ versionKey: false, timestamps: true })
export class CustomerRefreshToken extends Document {
  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, type: Types.ObjectId })
  customerId!: Types.ObjectId;

  @Prop({ required: true })
  expiryDate!: Date;
}

export const CustomerRefreshTokenSchema =
  SchemaFactory.createForClass(CustomerRefreshToken);

@Schema({ versionKey: false, timestamps: true })
export class CustomerResetToken extends Document {
  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, type: Types.ObjectId })
  customerId!: Types.ObjectId;

  @Prop({ required: true })
  expiryDate!: Date;
}

export const CustomerResetTokenSchema =
  SchemaFactory.createForClass(CustomerResetToken);
