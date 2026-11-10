import config from "@/config.json";

/**
 * Locales the site has translations for. Each store is published in some of
 * them, set on the platform dashboard (GET /settings/languages). Mirrors the
 * API's SUPPORTED_LANGUAGES.
 */
export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const RTL_LOCALES: readonly string[] = config.app.rtlLanguages;

export type StoreLocales = {
  /** The store's languages, default first; never empty. */
  languages: Locale[];
  /** Where "/" leads and what hreflang's x-default names. */
  defaultLanguage: Locale;
};

/**
 * What a store is taken to be published in when the API can't be asked: the
 * same as the API's own defaults, i.e. what every store served before
 * languages were configurable.
 */
export const FALLBACK_LOCALES: StoreLocales = {
  languages: config.app.languages as Locale[],
  defaultLanguage: config.app.defaultLanguage as Locale,
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Open Graph locale: Facebook knows Arabic only as ar_AR. */
export function ogLocale(locale: string): string {
  return locale === "ar" ? "ar_AR" : "en_US";
}

/**
 * The API's answer, checked: anything unexpected becomes null so callers use
 * the fallback rather than route a store by a malformed reply.
 */
export function parseStoreLocales(raw: unknown): StoreLocales | null {
  if (!raw || typeof raw !== "object") return null;
  const { languages, defaultLanguage } = raw as Record<string, unknown>;
  if (!Array.isArray(languages)) return null;
  const list = languages.filter(isSupportedLocale);
  if (!list.length || !isSupportedLocale(defaultLanguage) || !list.includes(defaultLanguage)) return null;
  return {
    languages: [defaultLanguage, ...list.filter((l) => l !== defaultLanguage)],
    defaultLanguage,
  };
}

/**
 * Pages that belong to the store's staff, not its public site: they stay
 * available in every supported language whatever the site is published in,
 * so an Arabic-speaking team can run an English-only store. None of them is
 * indexed (see robots.ts).
 */
const STAFF_PREFIXES = ["/admin", "/admin-print", "/login", "/forgot-password", "/reset-password"];

/** Takes the path after the locale ("/admin/orders"). */
export function isStaffPath(path: string): boolean {
  return STAFF_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

/** "/ar/products/x" → { locale: "ar", rest: "/products/x" }; a path with no supported locale → locale null. */
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const segment = pathname.split("/")[1];
  if (!isSupportedLocale(segment)) return { locale: null, rest: pathname };
  const rest = pathname.slice(segment.length + 1);
  return { locale: segment, rest: rest || "" };
}
