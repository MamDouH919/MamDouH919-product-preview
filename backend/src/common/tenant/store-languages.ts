/**
 * Languages the storefront has translations for. A store picks which of
 * these it is published in; adding one here also needs its translation file
 * in the frontend and the platform dashboard's list.
 */
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type StoreLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * What a store registered before languages were configurable is published
 * in — exactly what every store served then — so leaving the fields unset
 * changes nothing on a live site.
 */
export const DEFAULT_LANGUAGES: readonly StoreLanguage[] = ['en', 'ar'];
export const DEFAULT_LANGUAGE: StoreLanguage = 'ar';

export interface StoreLanguages {
  /** In the order the store lists them; never empty. */
  languages: StoreLanguage[];
  /** One of `languages`: where "/" leads and what hreflang's x-default names. */
  defaultLanguage: StoreLanguage;
}

export function isStoreLanguage(value: unknown): value is StoreLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * A store's languages with the defaults filled in. Throws when they don't
 * fit together, so a bad registry entry is refused before it serves a page.
 */
export function resolveStoreLanguages(
  host: string,
  languages: readonly string[] | undefined,
  defaultLanguage: string | undefined,
): StoreLanguages {
  const list = languages?.length ? [...languages] : [...DEFAULT_LANGUAGES];
  const unknown = list.filter((l) => !isStoreLanguage(l));
  if (unknown.length) {
    throw new Error(`${host}: unsupported language(s) ${unknown.join(', ')}; supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  if (new Set(list).size !== list.length) throw new Error(`${host}: a language is listed twice`);

  // Left unset, the default is the old one when the store still has it, else its first language.
  const fallback = list.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : list[0];
  const chosen = defaultLanguage ?? fallback;
  if (!list.includes(chosen)) {
    throw new Error(`${host}: default language ${chosen} is not one of its languages (${list.join(', ')})`);
  }
  return { languages: list as StoreLanguage[], defaultLanguage: chosen as StoreLanguage };
}
