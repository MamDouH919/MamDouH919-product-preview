import { useTranslation } from "react-i18next";
import type { AccountName } from "@/backend-api/statements/api";
import type { JournalSource } from "@/backend-api/accounting/api";

/** An account or product name in the dashboard's language, falling back to the other. */
export const useLocalName = () => {
  const { i18n } = useTranslation();
  return (name?: Partial<AccountName>) => (i18n.language === "ar" ? name?.ar || name?.en : name?.en || name?.ar) ?? "";
};

/** What posted an entry, in words: "Order #1001", "Manual entry". */
export const useSourceLabel = () => {
  const { t } = useTranslation();
  return (source: JournalSource) => {
    const kind = t(`accounting.sourceTypes.${source.type}`, { defaultValue: source.type });
    return source.number ? `${kind} #${source.number}` : kind;
  };
};

/** A calendar day as the store reads it: "1 Nov 2026". */
export const formatDay = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" });

export const monthStartInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

export const todayLocalInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
