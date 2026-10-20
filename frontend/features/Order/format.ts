import { LocalizedField } from "@/backend-api/globalTypes";

export const localized = (field: LocalizedField | undefined, lang: string): string =>
  field?.[lang] || field?.["ar"] || field?.["en"] || "";

/** "Street, building, area, subzone, zone" — falls back to the legacy free-text city. */
export const formatAddress = (
  address: {
    street?: string;
    building?: string;
    area?: string;
    subZoneName?: LocalizedField;
    zoneName?: LocalizedField;
    city?: string;
  },
  lang: string,
  separator = ", "
): string =>
  [
    address.street,
    address.building,
    address.area,
    localized(address.subZoneName, lang),
    localized(address.zoneName, lang) || address.city,
  ]
    .filter(Boolean)
    .join(separator);

export const formatMoney = (amount: number, currency: string): string =>
  `${amount.toLocaleString()} ${currency}`.trim();

/** An amount in minor units (piastres), always with its two decimals: 31500 → "315.00". */
export const formatMinorMoney = (minor: number, currency: string): string =>
  `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`.trim();

/** Minor units as the decimal string the API takes for an amount: 4550 → "45.50". */
export const minorToInput = (minor: number): string => (minor / 100).toFixed(2);

export const formatDateTime = (iso: string, lang: string): string =>
  new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
