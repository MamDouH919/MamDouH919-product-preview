import { LocalizedField } from "../globalTypes";
import type { StoreModule, StorePlan } from "@/lib/storeModules";

export type SocialMediaItem = {
  key: string;
  value: string;
};

/** How the home page banner slider moves: neighbours peeking and gliding, or full width cross-fading. */
export type BannerStyle = "peek" | "fade";

export const BANNER_STYLES: BannerStyle[] = ["peek", "fade"];

export type Setting = {
  _id: string;
  siteTitle?: LocalizedField;
  siteDescription?: LocalizedField;
  logo?: string;
  favicon?: string;
  phone?: string;
  whatsapp?: string;
  landLine?: string;
  email?: string;
  address?: string;
  socialMedia?: SocialMediaItem[];
  primaryColor?: string;
  currency?: LocalizedField;
  /** ISO country code the store delivers in; set by a super admin. */
  country?: string;
  /** Days after delivery a customer may request a return; 0 turns customer requests off. */
  returnWindowDays?: number;
  bannerStyle?: BannerStyle;
  /** Whether the storefront shows prices; only a store without online orders may turn it off. */
  showPrices?: boolean;
  /** Set by the platform, not the store: what the store is sold as, and the modules that come with it. */
  plan?: StorePlan;
  modules?: StoreModule[];
};

export type MailEncryption = "ssl" | "starttls" | "none";

export type MailNotifications = {
  customerOrderPlaced: boolean;
  customerOrderStatus: boolean;
  storeNewOrder: boolean;
  storeOrderCancelled: boolean;
  contactForm: boolean;
  customerAbandonedCart: boolean;
  storeReturnRequest: boolean;
};

/** The store's outgoing mail server. The password is never sent back. */
export type MailSetting = {
  _id: string;
  enabled: boolean;
  provider: string;
  host?: string;
  port: number;
  encryption: MailEncryption;
  allowInvalidCertificates: boolean;
  username?: string;
  hasPassword: boolean;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  notificationEmails: string[];
  bccEmails: string[];
  notifications: MailNotifications;
  updatedAt?: string;
};

export type UpdateMailSettingInput = Partial<
  Omit<MailSetting, "_id" | "hasPassword" | "updatedAt" | "fromEmail" | "replyTo">
> & {
  /** Null clears the field. */
  fromEmail?: string | null;
  replyTo?: string | null;
  /** Leave empty to keep the saved password. */
  password?: string;
  clearPassword?: boolean;
};
