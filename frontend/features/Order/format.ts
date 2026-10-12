import { LocalizedField } from "@/backend-api/globalTypes";

export const localized = (field: LocalizedField | undefined, lang: string): string =>
  field?.[lang] || field?.["ar"] || field?.["en"] || "";

export const formatMoney = (amount: number, currency: string): string =>
  `${amount.toLocaleString()} ${currency}`.trim();

export const formatDateTime = (iso: string, lang: string): string =>
  new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
