"use client";

import { Box, Stack, Tab, Tabs, type SxProps, type Theme } from "@mui/material";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useStoreLocales } from "@/lib/storeLocalesContext";
import type { Locale } from "@/lib/locales";

const TAB_LABEL: Record<Locale, string> = { ar: "arabic", en: "english" };

type Props = {
  /** The fields for one language; every language's stay mounted so the form validates them all. */
  children: (lang: Locale) => ReactNode;
  /** Marks a tab whose fields have errors. */
  hasError?: (lang: Locale) => boolean;
  spacing?: number;
  /** The languages to ask for, default the store's; see useContentLanguages. */
  languages?: Locale[];
  sx?: SxProps<Theme>;
};

/**
 * One tab per language the store's site is published in (set on the
 * platform), default language first. A one-language store gets its fields
 * without tabs.
 */
export default function LanguageTabs({ children, hasError, spacing = 2, languages: only, sx }: Props) {
  const { t } = useTranslation();
  const store = useStoreLocales();
  const languages = only?.length ? only : store.languages;
  const multilingual = languages.length > 1;
  const [active, setActive] = useState(0);
  const current = Math.min(active, languages.length - 1);

  return (
    <Stack spacing={2} sx={sx}>
      {multilingual && (
        <Tabs value={current} onChange={(_, v) => setActive(v)} variant="fullWidth">
          {languages.map((lang) => (
            <Tab
              key={lang}
              label={t(TAB_LABEL[lang])}
              iconPosition="end"
              icon={
                hasError?.(lang) ? (
                  <Box
                    component="span"
                    sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "error.main", display: "inline-block", ml: 0.5 }}
                  />
                ) : undefined
              }
            />
          ))}
        </Tabs>
      )}
      {languages.map((lang, i) => (
        <Stack key={lang} spacing={spacing} sx={{ display: current === i ? "flex" : "none" }}>
          {children(lang)}
        </Stack>
      ))}
    </Stack>
  );
}
