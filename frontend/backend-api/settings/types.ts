import { LocalizedField } from "../globalTypes";

export type SocialMediaItem = {
  key: string;
  value: string;
};

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
};

export type MailEncryption = "ssl" | "starttls" | "none";

export type MailNotifications = {
  customerOrderPlaced: boolean;
  customerOrderStatus: boolean;
  storeNewOrder: boolean;
  storeOrderCancelled: boolean;
  contactForm: boolean;
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
