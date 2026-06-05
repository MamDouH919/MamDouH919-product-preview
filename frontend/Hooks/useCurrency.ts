import { useAppSelector } from "@/Store/store";
import { useTranslation } from "react-i18next";

export function useCurrency(): string {
  const currency = useAppSelector((s) => s.settings.currency);
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return currency?.[lang] ?? currency?.["ar"] ?? currency?.["en"] ?? "";
}
