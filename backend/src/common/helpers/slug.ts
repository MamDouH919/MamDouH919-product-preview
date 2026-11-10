import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, ValidateIf } from 'class-validator';

/** A URL segment: lowercase English letters and numbers, joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Tidies what someone typed without changing what it says: lowercase, spaces
 * and underscores to hyphens, no doubled or edge hyphens ("Candy  perfume" →
 * "candy-perfume"). Characters a slug can't hold (Arabic, "@", "/", ".") are
 * left in, so validation reports them instead of silently dropping them.
 */
export function cleanSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A slug made from a name: cleaned, then anything a slug can't hold removed. Empty for an Arabic-only name. */
export function buildSlug(text: string): string {
  return cleanSlug(text)
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * A slug field: tidied with `cleanSlug`, then refused if anything is left that
 * a URL segment can't hold. Empty (or only spaces) passes as "", which the
 * services read as "make one from the name".
 */
export function IsSlug() {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? cleanSlug(value) : value)),
    IsString(),
    ValidateIf((_, value) => value !== ''),
    Matches(SLUG_PATTERN, {
      message: 'slug may only contain English letters, numbers, spaces and hyphens (e.g. "Candy perfume" becomes candy-perfume)',
    }),
  );
}
