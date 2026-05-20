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
};
