import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum MailEncryption {
  /** Implicit TLS from the first byte — usually port 465. */
  SSL = 'ssl',
  /** Plain connection upgraded with STARTTLS — usually port 587. */
  STARTTLS = 'starttls',
  /** No encryption (local relays only). */
  NONE = 'none',
}

/** Emails the store can switch on or off individually. */
export const MAIL_NOTIFICATIONS = [
  'customerOrderPlaced',
  'customerOrderStatus',
  'storeNewOrder',
  'storeOrderCancelled',
  'contactForm',
  'customerAbandonedCart',
] as const;
export type MailNotification = (typeof MAIL_NOTIFICATIONS)[number];

@Schema({ _id: false })
export class MailNotifications {
  @Prop({ default: true }) customerOrderPlaced!: boolean;
  @Prop({ default: true }) customerOrderStatus!: boolean;
  @Prop({ default: true }) storeNewOrder!: boolean;
  @Prop({ default: true }) storeOrderCancelled!: boolean;
  @Prop({ default: true }) contactForm!: boolean;
  /** Marketing, unlike the rest — so off until the store opts in. */
  @Prop({ default: false }) customerAbandonedCart!: boolean;
}
const MailNotificationsSchema = SchemaFactory.createForClass(MailNotifications);

/**
 * The store's outgoing mail server. Kept out of the public `Setting` document
 * so credentials can never leak through `GET /settings`.
 */
@Schema({ timestamps: true })
export class MailSetting extends Document {
  @Prop({ default: false })
  enabled!: boolean;

  /** Which preset the admin picked — UI only; host/port below are what's used. */
  @Prop({ default: 'custom' })
  provider!: string;

  @Prop({ trim: true })
  host?: string;

  @Prop({ default: 587 })
  port!: number;

  @Prop({ type: String, enum: MailEncryption, default: MailEncryption.STARTTLS })
  encryption!: MailEncryption;

  /** Accept self-signed / mismatched certificates (private servers). */
  @Prop({ default: false })
  allowInvalidCertificates!: boolean;

  @Prop({ trim: true })
  username?: string;

  /** Encrypted with `encryptSecret` — never returned to clients. */
  @Prop()
  password?: string;

  @Prop({ trim: true })
  fromName?: string;

  @Prop({ trim: true, lowercase: true })
  fromEmail?: string;

  @Prop({ trim: true, lowercase: true })
  replyTo?: string;

  /** Who receives store alerts (new orders, contact form). */
  @Prop({ type: [String], default: [] })
  notificationEmails!: string[];

  /** Silent copy of every customer-facing email. */
  @Prop({ type: [String], default: [] })
  bccEmails!: string[];

  @Prop({ type: MailNotificationsSchema, default: () => ({}) })
  notifications!: MailNotifications;

  updatedAt?: Date;
}

export const MailSettingSchema = SchemaFactory.createForClass(MailSetting);
