import { ValidationPipe } from '@nestjs/common';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { deleteFile, toPublicPath } from '../common/helpers/compress-image';

const NUMBER_FIELDS = ['price', 'stock', 'lowStockThreshold', 'order'] as const;
const BOOLEAN_FIELDS = ['isActive', 'trackStock', 'allowBackorder'] as const;
const VARIANT_NUMBER_FIELDS = ['price', 'stock'] as const;

// Same rules as the global pipe in main.ts, so a product is held to the same
// standard as every JSON endpoint.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const toNumber = (value: unknown) =>
  typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value;

const toBoolean = (value: unknown) =>
  value === 'true' ? true : value === 'false' ? false : value;

/**
 * Multipart forms send every field as a string ("10", "false") and some as
 * JSON or comma lists. Turn them into the types the DTO declares, then run the
 * DTO's validation — `@Body() body: any` alone skips it entirely, which let a
 * string stock reach the inventory ledger and negative prices into the store.
 */
export async function toProductDto<T extends object>(body: Record<string, any>, metatype: new () => T): Promise<T> {
  const data = parseNestedBody(body);

  if (typeof data.variants === 'string') {
    try {
      data.variants = JSON.parse(data.variants);
    } catch {
      data.variants = 'invalid';
    }
  }
  if (typeof data.tags === 'string') {
    data.tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  }
  // The admin form sends `images` as a JSON list so that "[]" can say "remove
  // them all"; a plain string is a single path.
  if (typeof data.images === 'string') {
    if (data.images.trim().startsWith('[')) {
      try {
        data.images = JSON.parse(data.images);
      } catch {
        data.images = 'invalid';
      }
    } else {
      data.images = [data.images];
    }
  }

  for (const field of NUMBER_FIELDS) if (field in data) data[field] = toNumber(data[field]);
  for (const field of BOOLEAN_FIELDS) if (field in data) data[field] = toBoolean(data[field]);
  if (Array.isArray(data.variants)) {
    for (const variant of data.variants) {
      if (variant && typeof variant === 'object') {
        for (const field of VARIANT_NUMBER_FIELDS) if (field in variant) variant[field] = toNumber(variant[field]);
      }
    }
  }

  const validated = await pipe.transform(data, { type: 'body', metatype });
  // Class fields compile to own properties set to undefined (ES2022+ targets).
  // Hand back only what the client actually sent, so "field absent" still
  // means "leave it as it is" on update.
  return JSON.parse(JSON.stringify(validated)) as T;
}

/** Multer saves files before the body is checked; a rejected request must not leave them behind. */
export const discardUploads =
  (files: Express.Multer.File[] | undefined) =>
  async (error: unknown): Promise<never> => {
    await Promise.all((files ?? []).map((f) => deleteFile(toPublicPath(f.path))));
    throw error;
  };
