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
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + (extname(file.originalname) || '.jpg'));
    },
  });
}
