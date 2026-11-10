/**
 * Slugs as the backend accepts them (backend/src/common/helpers/slug.ts): the
 * form tidies case and spaces itself and only refuses what can't be tidied.
 */

/** A URL segment: lowercase English letters and numbers, joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Lowercase, spaces and underscores to hyphens, no doubled or edge hyphens
 * ("Candy  perfume" → "candy-perfume"). Other characters (Arabic, "@", "/")
 * stay, so validation can point them out.
 */
export function cleanSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}
