import { headers } from "next/headers";
import config from "@/config.json";
import { backendUrlForHost } from "@/lib/getBackendUrl";

export const LOCALES = config.app.languages;
export const DEFAULT_LOCALE = config.app.defaultLanguage;

/**
 * The storefront origin this request came in on, e.g. "https://gravity.novaslash.com".
 * Built from the request rather than config, so every tenant's sitemap and
 * canonical URLs point at its own domain.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const local = /^(localhost|127\.0\.0\.1)$|\.localhost$/.test(host.split(":")[0]);
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** This tenant's backend, resolved from the request host. */
export async function requestBackendUrl(): Promise<string> {
  const h = await headers();
  return backendUrlForHost(h.get("x-forwarded-host") ?? h.get("host"));
}

/** GET a public backend route; `null` on any failure so SEO never breaks a page. */
export async function fetchBackend<T>(path: string, revalidate = 300): Promise<T | null> {
  const backendUrl = await requestBackendUrl();
  if (!backendUrl) return null;
  try {
    const res = await fetch(`${backendUrl}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** `{ en: origin/en/path, ar: origin/ar/path, x-default: … }` for hreflang alternates. */
export function languageAlternates(origin: string, path: string): Record<string, string> {
  const alternates: Record<string, string> = Object.fromEntries(
    LOCALES.map((locale) => [locale, `${origin}/${locale}${path}`])
  );
  alternates["x-default"] = `${origin}/${DEFAULT_LOCALE}${path}`;
  return alternates;
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
 * ISO 4217 code for structured data. The store's currency is free text
 * ("ج.م", "LE"), so it's used only if it already looks like a code; otherwise
 * the delivery country decides. `undefined` means don't claim a price at all.
 */
export function isoCurrency(settings: {
  currency?: Record<string, string | undefined>;
  country?: string;
} | null): string | undefined {
  const candidate = settings?.currency?.en?.trim().toUpperCase();
  if (candidate && /^[A-Z]{3}$/.test(candidate)) return candidate;
  return settings?.country ? COUNTRY_CURRENCY[settings.country.toUpperCase()] : undefined;
}
