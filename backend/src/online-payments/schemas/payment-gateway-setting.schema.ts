import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

/**
 * The store's payment-gateway account. One document per store, kept out of
 * `Setting` so keys can never leak through the public `GET /settings`.
 */
@Schema({ timestamps: true })
export class PaymentGatewaySetting extends Document {
  /** Whether customers are offered online payment at checkout. */
  @Prop({ default: false })
  enabled!: boolean;

  /** The gateway in use (a `GatewayId`). Only one at a time. */
  @Prop({ type: String, required: false })
  provider?: string;

  /**
   * Credentials per gateway, so switching away and back keeps the keys.
   * Secret fields (as the gateway declares them) are encrypted with
   * `encryptSecret`; the rest are stored as typed.
   */
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  credentials!: Record<string, Record<string, string>>;
}

export const PaymentGatewaySettingSchema = SchemaFactory.createForClass(PaymentGatewaySetting);
