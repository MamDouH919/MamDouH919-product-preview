import type { Metadata } from "next";
import { headers } from "next/headers";
import { backendUrlForHost } from "@/lib/getBackendUrl";
import { resolveTenantSeo } from "@/lib/tenantSeo";
import { FALLBACK_LOCALES, ogLocale, parseStoreLocales, type StoreLocales } from "@/lib/locales";

/**
 * The storefront origin this request came in on, e.g. "https://gravity.novaslash.com".
 * Built from the request rather than config, so every tenant's sitemap and
 * canonical URLs point at its own domain.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  // Behind more than one proxy this can be a list ("a.com, b.com"); the first is the client's.
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1)$|\.localhost$/.test(host.split(":")[0]);
  // Public stores are only served over https; the proxy in front of Next may
  // still report "http" for its own hop, which would leak into canonicals and feeds.
  const proto = local ? (h.get("x-forwarded-proto")?.split(",")[0] ?? "http") : "https";
  return `${proto}://${host}`;
}

/** This tenant's backend, resolved from the request host. */
export async function requestBackendUrl(): Promise<string> {
  const h = await headers();
  return backendUrlForHost(h.get("x-forwarded-host") ?? h.get("host"));
}

/**
 * GET a public backend route, telling "it doesn't exist" (404) apart from
 * "couldn't ask" (backend down, timeout). Only the first may become a 404 page:
 * answering 404 while the backend is down would get pages dropped from search.
 */
export type Fetched<T> = { ok: true; data: T } | { ok: false; missing: boolean };

export async function fetchBackendResult<T>(path: string, revalidate = 300): Promise<Fetched<T>> {
  const backendUrl = await requestBackendUrl();
  if (!backendUrl) return { ok: false, missing: false };
  try {
    const res = await fetch(`${backendUrl}${path}`, { next: { revalidate } });
    if (!res.ok) return { ok: false, missing: res.status === 404 };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, missing: false };
  }
}

/** GET a public backend route; `null` on any failure so SEO never breaks a page. */
export async function fetchBackend<T>(path: string, revalidate = 300): Promise<T | null> {
  const result = await fetchBackendResult<T>(path, revalidate);
  return result.ok ? result.data : null;
}

/**
 * The languages this request's store is published in, as set on the platform
 * dashboard. Cached like the layout's settings, so a change shows within a
 * minute. When the API can't be asked, the defaults — never an error, so
 * metadata, sitemap and feeds keep answering.
 */
export async function getStoreLocales(): Promise<StoreLocales> {
  const result = await fetchBackendResult<unknown>("/settings/languages", 60);
  return (result.ok && parseStoreLocales(result.data)) || FALLBACK_LOCALES;
}

/**
 * `{ en: origin/en/path, ar: origin/ar/path, x-default: … }` for hreflang
 * alternates, in the store's languages only. A store in one language gets
 * none: hreflang only links translations, and listing a page as its own
 * alternate says nothing.
 */
export function languageAlternates(
  origin: string,
  path: string,
  { languages, defaultLanguage }: StoreLocales
): Record<string, string> | undefined {
  if (languages.length < 2) return undefined;
  const alternates: Record<string, string> = Object.fromEntries(
    languages.map((locale) => [locale, `${origin}/${locale}${path}`])
  );
  alternates["x-default"] = `${origin}/${defaultLanguage}${path}`;
  return alternates;
}

type PageSeo = {
  locale: string;
  /** The part after the locale: "" for home, "/products", "/categories/rings". */
  path: string;
  /** Without the site name; the layout's template adds it. Omit for the site's own title. */
  title?: string;
  /**
   * Added to `title` in order ("Name | From 300 EGP"), each only while the full
   * title, site name included, stays within what search results show.
   */
  titleExtras?: string[];
  description?: string;
  /** Absolute share-image URL; defaults to the store's. */
  image?: { url: string; width?: number; height?: number; alt?: string };
  /** False keeps the page out of search results but lets crawlers follow its links. */
  index?: boolean;
};

/**
 * Complete metadata for a storefront page: canonical, hreflang alternates,
 * Open Graph and Twitter. Complete because Next merges these objects
 * shallowly — a page that set only `openGraph.url` would lose the layout's
 * image and site name. Query strings (filters, sort, search) are left out of
 * the canonical, so every filtered view points search engines at one page.
 */
export async function pageMetadata({ locale, path, title: baseTitle, titleExtras = [], description, image, index = true }: PageSeo): Promise<Metadata> {
  const [h, origin, locales] = await Promise.all([headers(), requestOrigin(), getStoreLocales()]);
  const tenant = resolveTenantSeo(h.get("x-forwarded-host") ?? h.get("host"));
  const seo = tenant[locale === "ar" ? "ar" : "en"];
  const title = baseTitle && fitTitle(baseTitle, titleExtras, seo.titleTemplate);
  const url = `${origin}/${locale}${path}`;
  const shareTitle = title ? seo.titleTemplate.replace("%s", title) : seo.title;
  const shareDescription = description || seo.description;
  const images = [image ?? (await storeShareImage(origin, tenant.siteName))];

  return {
    ...(title ? { title } : {}),
    description: shareDescription,
    alternates: { canonical: url, languages: languageAlternates(origin, path, locales) },
    robots: { index, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: tenant.siteName,
      title: shareTitle,
      description: shareDescription,
      locale: ogLocale(locale),
      alternateLocale: locales.languages.filter((l) => l !== locale).map(ogLocale),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: images.map((i) => i.url),
    },
  };
}

/**
 * The store's 1200×630 share image (app/api/og/store), for pages without one
 * of their own. `v` follows the logo's file name, so a new logo isn't kept
 * away by WhatsApp's and Facebook's caches.
 */
export async function storeShareImage(origin: string, alt: string) {
  const settings = await fetchBackend<{ logo?: string }>("/settings", 60);
  const v = settings?.logo?.split("/").pop();
  return { url: `${origin}/api/og/store${v ? `?v=${encodeURIComponent(v)}` : ""}`, width: 1200, height: 630, alt };
}

/** Longest title search results show in full, site name included. */
const TITLE_MAX = 60;

/** `base`, then each extra that still fits once the template adds the site name. */
export function fitTitle(base: string, extras: string[], template: string): string {
  let title = base.replace(/\s+/g, " ").trim();
  for (const extra of extras) {
    if (!extra) continue;
    const next = `${title} | ${extra}`;
    if (template.replace("%s", next).length > TITLE_MAX) break;
    title = next;
  }
  return title;
}

/**
 * Below this, a description is too thin to win the snippet: search engines
 * write their own from the page instead.
 */
export const DESCRIPTION_MIN = 120;

/** Clip to the length search results show, on a word boundary. */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return (cut.slice(0, cut.lastIndexOf(" ")) || cut) + "…";
}

const COUNTRY_CURRENCY: Record<string, string> = {
  EG: "EGP",
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  QA: "QAR",
  BH: "BHD",
  OM: "OMR",
  JO: "JOD",
  US: "USD",
};

/**
 * ISO 4217 code for structured data and feeds. The store keeps one
 * (`currencyCode`); older settings without it fall back to the display text
 * ("ج.م", "LE") if it already looks like a code, then to the delivery country.
 * `undefined` means don't claim a price at all.
 */
export function isoCurrency(settings: {
  currencyCode?: string;
  currency?: Record<string, string | undefined>;
  country?: string;
} | null): string | undefined {
  for (const candidate of [settings?.currencyCode, settings?.currency?.en]) {
    const code = candidate?.trim().toUpperCase();
    if (code && /^[A-Z]{3}$/.test(code)) return code;
  }
  return settings?.country ? COUNTRY_CURRENCY[settings.country.toUpperCase()] : undefined;
}
