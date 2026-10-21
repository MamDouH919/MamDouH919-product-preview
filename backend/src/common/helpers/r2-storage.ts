import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import { extname } from 'path';

/**
 * Cloudflare R2 (S3-compatible) storage for uploaded images.
 *
 * One bucket for every tenant; objects keep the same layout the local
 * uploads folder had:
 *
 *   <tenant>/<subdir>/<unique>.<ext>
 *
 * and the database stores the full public URL (`${R2_PUBLIC_URL}/<key>`).
 * When the R2_* variables are not set (local development) nothing here is
 * used and files stay on disk under ./uploads.
 */

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

let client: S3Client | null = null;

/** True when every R2 variable is set. */
export function r2Enabled(): boolean {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);
}

function r2(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

/** The public base URL, without a trailing slash, e.g. "https://pub-xxx.r2.dev". */
export function r2PublicUrl(): string {
  return (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
}

/** "./uploads/localhost/products/1.webp" → "localhost/products/1.webp" */
export function keyForLocalPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\/?uploads\//, '');
}

/** The object key behind a public R2 URL, or null when the URL isn't ours. */
export function keyForUrl(url: string): string | null {
  const base = r2PublicUrl();
  if (!base || !url.startsWith(base + '/')) return null;
  return decodeURIComponent(url.slice(base.length + 1).split(/[?#]/)[0]);
}

export function publicUrlForKey(key: string): string {
  return `${r2PublicUrl()}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** Uploads a local file under `key` and returns its public URL. */
export async function uploadToR2(filePath: string, key: string): Promise<string> {
  await r2().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: await readFile(filePath),
      ContentType: CONTENT_TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream',
      // Names are unique per upload, so a cached copy never goes stale.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return publicUrlForKey(key);
}

export async function existsInR2(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return true;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}
