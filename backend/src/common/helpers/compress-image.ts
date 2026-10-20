import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { extname } from 'path';

interface CompressOptions {
  maxWidth?: number;
  quality?: number;
}

const FORMAT_MAP: Record<string, keyof sharp.FormatEnum> = {
  '.jpg':  'jpeg',
  '.jpeg': 'jpeg',
  '.png':  'png',
  '.webp': 'webp',
  '.avif': 'avif',
  '.tiff': 'tiff',
  '.tif':  'tiff',
};

const EXT_MAP: Record<string, string> = {
  jpeg: '.jpg',
  png:  '.png',
  webp: '.webp',
  avif: '.avif',
  tiff: '.tiff',
};

/**
 * Compresses an uploaded image file in-place using sharp.
 * Preserves the original file extension. GIFs are kept as they are once
 * confirmed to be images (re-encoding would drop animation). A file sharp
 * can't read is removed and reported as a 400, not left to become a 500.
 * Returns the file path to save in the database.
 */
export async function compressImage(
  file: Express.Multer.File,
  options: CompressOptions = {},
): Promise<string> {
  const { maxWidth = 1280, quality = 100 } = options;
  // The stored name carries the checked extension (an upload named "blob" has none of its own).
  const ext = (extname(file.path) || extname(file.originalname)).toLowerCase();

  if (ext === '.svg') {
    await discard(file.path);
    throw new BadRequestException(`"${file.originalname}" is an SVG; upload a JPG, PNG, WebP or GIF`);
  }

  if (ext === '.gif') {
    try {
      const { format: actual } = await sharp(file.path).metadata();
      if (actual !== 'gif') throw new Error(`content is ${actual}`);
    } catch {
      await discard(file.path);
      throw new BadRequestException(`"${file.originalname}" is not a valid image`);
    }
    return file.path;
  }

  const format = FORMAT_MAP[ext] ?? 'jpeg';
  const outputExt = EXT_MAP[format] ?? '.jpg';

  // Strip current extension (if any) and apply the correct one
  const currentExt = extname(file.path);
  const basePath = currentExt ? file.path.slice(0, -currentExt.length) : file.path;
  const outputPath = basePath + outputExt;
  const tmpPath = outputPath + '.tmp';

  try {
    await sharp(file.path)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .toFormat(format, { quality })
      .toFile(tmpPath);
  } catch {
    await Promise.all([discard(file.path), discard(tmpPath)]);
    throw new BadRequestException(`"${file.originalname}" is not a valid image`);
  }

  const fs = await import('fs/promises');
  await fs.unlink(file.path).catch(() => null);
  await fs.rename(tmpPath, outputPath);

  return outputPath;
}

/**
 * Returns the public URL path for a compressed image.
 * e.g. "./uploads/teams/123.webp" → "/uploads/teams/123.webp"
 */
export function toPublicPath(filePath: string): string {
  return '/' + filePath.replace(/^\.\//, '');
}

/**
 * Deletes a file from disk given its stored public path.
 * e.g. "/uploads/banners/foo.webp" → deletes "./uploads/banners/foo.webp"
 * Silently ignores missing files.
 */
export async function deleteFile(publicPath: string): Promise<void> {
  if (!publicPath) return;
  const fs = await import('fs/promises');
  await fs.unlink('.' + publicPath).catch(() => null);
}

async function discard(path: string): Promise<void> {
  const fs = await import('fs/promises');
  await fs.unlink(path).catch(() => null);
}
