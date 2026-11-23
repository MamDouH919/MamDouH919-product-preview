import { LocalizedField } from "@/backend-api/globalTypes";
import type { ContentLanguages } from "@/backend-api/settings/types";
import { SUPPORTED_LOCALES } from "@/lib/locales";

export type SocialItem = { key: string; value: string };

export type SettingsFormValues = {
  siteTitle: LocalizedField;
  siteDescription: LocalizedField;
  currency: LocalizedField;
  logo: File | string | null;
  favicon: File | string | null;
  phone: string;
  whatsapp: string;
  landLine: string;
  email: string;
  address: string;
  socialMedia: SocialItem[];
  primaryColor?: string;
  country: string;
  returnWindowDays: string;
  showPrices: boolean;
  preorderEnabled: boolean;
  contentLanguages: ContentLanguages;
  costPlus5Percent: boolean;
  costPlus15Percent: boolean;
};

/**
 * Texts are kept for every supported language, so turning a language off on
 * the platform and back on loses nothing; only the store's own are shown.
 */
export const ALL_LANGS: readonly string[] = SUPPORTED_LOCALES;
