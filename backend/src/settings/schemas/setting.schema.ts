import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { LocalizedField, LocalizedFieldSchema } from '../../common/schemas/localized-field.schema';
import { DEFAULT_CURRENCY } from '../../common/money/money';
import { DEFAULT_TIME_ZONE } from '../../common/helpers/time-zone';

export class SocialMediaItem {
  key!: string;
  value!: string;
}

/** When a refund also gives back the delivery fee (finance specification, section 7). */
export enum DeliveryFeeRefundPolicy {
  /** Never; an approver can still grant it, with a note. */
  NEVER = 'never',
  /** Only when every unit comes back and it was the store's fault (damaged, wrong, not as described, late). */
  STORE_FAULT_FULL_RETURN = 'store_fault_full_return',
  /** Whenever every unit comes back, whatever the reason. */
  FULL_RETURN = 'full_return',
  /** The approver decides each time. */
  MANUAL = 'manual',
}

/** How the storefront's banner slider moves between slides. */
export enum BannerStyle {
  /** One slide centred with its neighbours peeking at the sides; slides glide. */
  PEEK = 'peek',
  /** Full width, one slide at a time; slides cross-fade. */
  FADE = 'fade',
}

/** One change to the store's finance rules, with what it was and what it became. */
@Schema({ _id: false })
export class FinanceSettingChange {
  @Prop({ required: true })
  field!: string;

  @Prop({ type: Object })
  from?: unknown;

  @Prop({ type: Object })
  to?: unknown;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  by?: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;
}

export const FinanceSettingChangeSchema = SchemaFactory.createForClass(FinanceSettingChange);

/** The store's books: when they start, how far back they are closed, and the refund rules. */
@Schema({ _id: false })
export class FinanceSettings {
  /**
   * When this store's books start. Orders delivered before it stay as
   * history and are never posted; set once, by the backfill or the first
   * posting, and never moved.
   */
  @Prop({ type: Date, required: false })
  goLiveAt?: Date;

  /**
   * Nothing may be posted with an effective date on or before this instant —
   * the last moment of `lockedThroughDay` in the store's time zone.
   */
  @Prop({ type: Date, required: false })
  lockedThrough?: Date;

  /** The last closed day as the store reads it, `YYYY-MM-DD`. */
  @Prop({ required: false })
  lockedThroughDay?: string;

  /** Refunds up to this (minor units) are approved as they are requested. */
  @Prop({ min: 0, required: false })
  refundAutoApproveUpToMinor?: number;

  /** Above this, a refund needs an approver who is not the person who asked for it. */
  @Prop({ min: 0, required: false })
  refundSingleApproverUpToMinor?: number;

  @Prop({ type: String, enum: DeliveryFeeRefundPolicy, required: false })
  deliveryFeeRefund?: DeliveryFeeRefundPolicy;

  /** Every change to the rules above, oldest first. */
  @Prop({ type: [FinanceSettingChangeSchema], default: [] })
  history!: FinanceSettingChange[];
}

export const FinanceSettingsSchema = SchemaFactory.createForClass(FinanceSettings);

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

  /** How the currency is written to shoppers ("جنية" / "EGP"). Display only. */
  @Prop({ type: LocalizedFieldSchema, required: false })
  currency?: LocalizedField;

  /**
   * ISO 4217 code the store's money is kept in. Its minor unit comes from
   * `CURRENCIES`. Only the store's Super Admin sets it, and never once the
   * store has orders — every amount on them is in this currency.
   */
  @Prop({ default: DEFAULT_CURRENCY })
  currencyCode!: string;

  /** IANA zone the store's business day runs in; report periods start at its midnight. */
  @Prop({ default: DEFAULT_TIME_ZONE })
  timezone!: string;

  @Prop({ type: FinanceSettingsSchema, default: () => ({}) })
  finance!: FinanceSettings;

  /**
   * ISO 3166-1 alpha-2 code of the country the store delivers in. Only a super
   * admin sets it; doing so seeds that country's zones for the price list.
   */
  @Prop({ required: false })
  country?: string;

  /**
   * One delivery fee for every area of `country`. While set, it replaces the
   * price list: every subzone is deliverable at this price. Unset (null) means
   * each area's own row in the price list applies.
   */
  @Prop({ type: Number, min: 0, required: false, default: null })
  flatDeliveryPrice?: number | null;

  /** Days after delivery a customer may ask for a return from their account. 0 turns that off. */
  @Prop({ default: 14, min: 0, max: 365 })
  returnWindowDays!: number;

  @Prop({ type: String, enum: BannerStyle, default: BannerStyle.PEEK })
  bannerStyle!: BannerStyle;

  /** Whether the storefront shows prices. Off suits a showcase store that quotes on WhatsApp. */
  @Prop({ default: true })
  showPrices!: boolean;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
