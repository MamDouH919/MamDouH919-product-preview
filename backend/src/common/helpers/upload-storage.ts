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

/** Videos are stored as uploaded (no re-encoding). Only for storages that opt in. */
const VIDEO_TYPES: Record<string, string[]> = {
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
};

const VIDEO_EXT_BY_TYPE: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

/**
 * Multer disk storage that writes uploads under a per-tenant folder:
 *
 *   ./uploads/<tenant>/<subdir>/<unique>.<ext>
 *
 * Because the tenant is baked into the path that gets stored in the DB, tenants
 * never share or overwrite each other's files. The folder is created on demand.
 */
export function tenantImageStorage(subdir: string, options: { allowVideo?: boolean } = {}) {
  const imageTypes = IMAGE_TYPES;
  const types = options.allowVideo ? { ...IMAGE_TYPES, ...VIDEO_TYPES } : imageTypes;
  const extByType = options.allowVideo ? { ...EXT_BY_TYPE, ...VIDEO_EXT_BY_TYPE } : EXT_BY_TYPE;
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
      const ext = named || extByType[file.mimetype];
      if (!ext || !types[ext]?.includes(file.mimetype)) {
        return cb(new BadRequestException(`"${file.originalname}" is not a supported ${options.allowVideo ? 'image or video (JPG, PNG, WebP, AVIF, GIF, MP4, WebM)' : 'image (JPG, PNG, WebP, AVIF, GIF)'}`), '');
      }
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + ext);
    },
  });
}
