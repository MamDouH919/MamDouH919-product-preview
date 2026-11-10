import { SUPPORTED_LOCALES } from "@/lib/locales"

/**
 * Mentions of the store's own products, categories and sub-categories inside
 * rich text (pages, home sections). The editor stores each as a link without
 * a locale — `<a data-type="mention" data-kind="product" href="/products/slug">`
 * — so one text serves both languages; `localizeMentions` adds the reader's
 * locale when the text is shown.
 */

export type MentionKind = "product" | "category" | "subCategory"

export const MENTION_KIND_LABEL: Record<MentionKind, { ar: string; en: string }> = {
  product: { ar: "منتج", en: "Product" },
  category: { ar: "قسم", en: "Category" },
  subCategory: { ar: "قسم فرعي", en: "Sub-category" },
}

/** Where a mention points, without the locale. A sub-category has no page of its own: it opens the filtered product list. */
export function mentionHref(
  kind: MentionKind,
  target: { slug?: string; id?: string; categoryId?: string }
): string {
  switch (kind) {
    case "product":
      return `/products/${encodeURIComponent(target.slug ?? "")}`
    case "category":
      return `/categories/${encodeURIComponent(target.slug ?? "")}`
    case "subCategory":
      return `/products?category=${encodeURIComponent(target.categoryId ?? "")}&sub=${encodeURIComponent(target.id ?? "")}`
  }
}

const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?:/|$)`)

/** Prefixes every mention link in `html` with `locale`, so it opens in the reader's language without a redirect. */
export function localizeMentions(html: string, locale: string | undefined): string {
  if (!html || !locale || !html.includes('data-type="mention"')) return html
  return html.replace(/<a\b[^>]*\bdata-type="mention"[^>]*>/g, (tag) =>
    tag.replace(/\bhref="(\/[^"]*)"/, (attr, path: string) =>
      LOCALE_PREFIX.test(path) ? attr : `href="/${locale}${path}"`
    )
  )
}
