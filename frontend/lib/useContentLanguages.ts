"use client";

import { useEffect } from "react";
import type { FieldValues, Path, PathValue, UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { useSettingsQuery } from "@/backend-api/settings/hooks";
import type { LocalizedField } from "@/backend-api/globalTypes";
import { SUPPORTED_LOCALES, type Locale } from "./locales";
import { useStoreLocales } from "./storeLocalesContext";

/**
 * The languages a product or category form asks for. The store's settings
 * may say texts are typed in one language only (`contentLanguages`): the
 * form then shows that language's inputs alone, and `fill` copies what was
 * typed into every language before it is sent, so the storefront has the
 * same text in each. A store published in one language asks for that one,
 * whatever the setting says.
 */
export function useContentLanguages() {
  const { languages: siteLanguages } = useStoreLocales();
  const { data: settings } = useSettingsQuery();
  const mode = settings?.contentLanguages ?? "both";
  const single: Locale | null =
    siteLanguages.length > 1 && mode !== "both" && siteLanguages.includes(mode) ? mode : null;

  return {
    /** The languages to show inputs for. */
    languages: single ? [single] : siteLanguages,
    /** The one language typed in, or null when each language has its own text. */
    single,
    /** The field as it should be saved: in single mode the typed text under every language. */
    fill(field: LocalizedField | undefined): LocalizedField {
      if (!single) return field ?? {};
      const text = field?.[single] ?? "";
      return Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, text]));
    },
  };
}

/**
 * When a form switches to one language, an input left empty there takes the
 * text another language already has, so editing something written before the
 * switch doesn't start from nothing (and saving doesn't wipe it).
 */
export function useSeedSingleLanguage<T extends FieldValues>(
  single: Locale | null,
  fields: Path<T>[],
  getValues: UseFormGetValues<T>,
  setValue: UseFormSetValue<T>,
) {
  useEffect(() => {
    if (!single) return;
    for (const field of fields) {
      const value = (getValues(field) ?? {}) as LocalizedField;
      if (value[single]) continue;
      const other = SUPPORTED_LOCALES.map((l) => value[l]).find(Boolean);
      if (other) setValue(`${field}.${single}` as Path<T>, other as PathValue<T, Path<T>>);
    }
    // The fields are a fixed list per form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single]);
}
