"use client"

import { useTranslation } from "react-i18next"
import { useTheme } from "@mui/material/styles"
import { useSectionByNameQuery } from "@/backend-api/sections/hooks"
import { LocalizedField } from "@/backend-api/globalTypes"

/**
 * Loads a home-page section by its `sectionName` and hands back what every
 * section renders with: the text picker for the current language and the
 * theme colours as CSS variables.
 */
export function useHomeSection(sectionName: string) {
  const { data: section, isLoading } = useSectionByNameQuery(sectionName)
  const { i18n } = useTranslation()
  const theme = useTheme()

  const text = (field?: LocalizedField) =>
    field?.[i18n.language] || field?.ar || field?.en || ""

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--on-primary": theme.palette.primary.contrastText,
  } as React.CSSProperties

  return { section, isLoading, text, cssVars, isRtl: i18n.dir() === "rtl" }
}

/** True when rich-text HTML has something visible, not just an empty `<p></p>`. */
export const hasHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim().length > 0
