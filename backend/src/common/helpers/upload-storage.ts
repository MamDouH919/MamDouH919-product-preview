import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import type { Request } from 'express';

/**
 * Turns the current tenant host into a filesystem-safe folder name.
 *
 * `req.hostname` comes from the client-controlled Host header, so we strip
 * anything that isn't hostname-safe to prevent path traversal (e.g. a Host of
 * "../../etc" can never escape the uploads directory).
 */
function tenantFolder(req: Request): string {
  const raw = (req as any).tenant ?? req.hostname ?? 'unknown';
  const safe = String(raw).toLowerCase().replace(/[^a-z0-9.-]/g, '_');
  return safe && safe !== '.' && safe !== '..' ? safe : 'unknown';
}

/**
 * Raster formats only. SVG is refused outright: it is a document that can
 * carry script, and it would be served from the API's own origin.
 */
const IMAGE_TYPES: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.avif': ['image/avif'],
  '.gif': ['image/gif'],
  '.tif': ['image/tiff'],
  '.tiff': ['image/tiff'],
};

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/tiff': '.tiff',
};

/**
 * Multer disk storage that writes uploads under a per-tenant folder:
 *
 *   ./uploads/<tenant>/<subdir>/<unique>.<ext>
 *
 * Because the tenant is baked into the path that gets stored in the DB, tenants
 * never share or overwrite each other's files. The folder is created on demand.
 */
export function tenantImageStorage(subdir: string) {
  return diskStorage({
    destination: (req, _file, cb) => {
      const dir = `./uploads/${tenantFolder(req as Request)}/${subdir}`;
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      // Browser-compressed images arrive as a nameless "blob": take the
      // extension from the type then. Otherwise both must agree. The content
      // itself is checked when sharp reads it.
      const named = extname(file.originalname).toLowerCase();
      const ext = named || EXT_BY_TYPE[file.mimetype];
      if (!ext || !IMAGE_TYPES[ext]?.includes(file.mimetype)) {
        return cb(new BadRequestException(`"${file.originalname}" is not a supported image (JPG, PNG, WebP, AVIF, GIF)`), '');
      }
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + ext);
    },
  });
}
