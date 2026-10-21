/**
 * Moves a store's existing images from ./uploads to Cloudflare R2 and points
 * the database at them.
 *
 *   npm run migrate:r2 -- <host>            # report what would change
 *   npm run migrate:r2 -- <host> --apply    # upload, then rewrite the paths
 *
 * Every "/uploads/<key>" string in the store's database — whole values like
 * `image`, and ones inside HTML such as page blocks — becomes
 * `${R2_PUBLIC_URL}/<key>`, with the file uploaded under the same <key>.
 * A reference whose file is missing on disk is reported and left as it is.
 *
 * Run it on the server that holds the files, with the R2_* variables set.
 * Local files are not deleted; remove ./uploads once the site looks right.
 * Safe to run again: uploaded objects are skipped and rewritten paths no
 * longer match. Take a backup first (`mongodump --db <store db>`).
 */
import 'dotenv/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { Connection } from 'mongoose';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { existsInR2, publicUrlForKey, r2Enabled, uploadToR2 } from '../src/common/helpers/r2-storage';

/** "/uploads/<key>" as a whole value, or inside HTML/CSS after a quote, paren, space or "=". */
const UPLOAD_PATH = /(^|["'(\s=])\/uploads\/([^\s"'()<>?#]+)/g;

function keysIn(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    for (const m of value.matchAll(UPLOAD_PATH)) out.add(decodeURIComponent(m[2]));
  } else if (Array.isArray(value)) {
    value.forEach((v) => keysIn(v, out));
  } else if (value && typeof value === 'object' && !(value instanceof Date) && !('_bsontype' in value)) {
    Object.values(value).forEach((v) => keysIn(v, out));
  }
}

/** A copy of `value` with every uploaded key rewritten to its R2 URL. */
function rewrite(value: unknown, moved: Set<string>): unknown {
  if (typeof value === 'string') {
    return value.replace(UPLOAD_PATH, (whole, lead: string, raw: string) => {
      const key = decodeURIComponent(raw);
      return moved.has(key) ? lead + publicUrlForKey(key) : whole;
    });
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, moved));
  if (value && typeof value === 'object' && !(value instanceof Date) && !('_bsontype' in value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, moved)]));
  }
  return value;
}

async function collections(db: Connection) {
  return (await db.db!.listCollections({ type: 'collection' }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.'));
}

async function main() {
  const [host, flag] = process.argv.slice(2);
  if (!host) throw new Error('Usage: npm run migrate:r2 -- <host> [--apply]');
  if (!r2Enabled()) throw new Error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL first');
  const apply = flag === '--apply';
  const db = await new TenantConnectionService().getConnection(host);
  console.log(`Store ${host} — ${apply ? 'APPLYING' : 'dry run (add --apply to write)'}`);

  // 1. Every file the database refers to.
  const names = await collections(db);
  const referenced = new Set<string>();
  for (const name of names) {
    const keys = new Set<string>();
    for (const doc of await db.collection(name).find({}).toArray()) keysIn(doc, keys);
    keys.forEach((k) => referenced.add(k));
    if (keys.size) console.log(`  ${name}: ${keys.size} file(s)`);
  }
  if (!referenced.size) {
    console.log('  nothing under /uploads — already migrated');
    await db.close();
    return;
  }

  // 2. Upload the ones that exist on disk.
  const moved = new Set<string>();
  const missing: string[] = [];
  let uploaded = 0;
  for (const key of referenced) {
    const file = join(process.cwd(), 'uploads', key);
    if (!file.startsWith(join(process.cwd(), 'uploads') + '/') || !existsSync(file)) {
      missing.push(key);
      continue;
    }
    moved.add(key);
    if (!apply) continue;
    if (!(await existsInR2(key))) {
      await uploadToR2(file, key);
      uploaded++;
    }
  }
  console.log(`  files: ${moved.size} on disk, ${missing.length} missing`);
  for (const key of missing) console.log(`    missing: uploads/${key} (reference left unchanged)`);
  if (!apply) {
    await db.close();
    return;
  }
  console.log(`  uploaded: ${uploaded} (already in R2: ${moved.size - uploaded})`);

  // 3. Point the documents at R2, only after every upload succeeded.
  let written = 0;
  for (const name of names) {
    const col = db.collection(name);
    for (const doc of await col.find({}).toArray()) {
      const set: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(doc)) {
        if (field === '_id') continue;
        const next = rewrite(value, moved);
        if (JSON.stringify(next) !== JSON.stringify(value)) set[field] = next;
      }
      if (!Object.keys(set).length) continue;
      await col.updateOne({ _id: doc._id }, { $set: set });
      written++;
    }
  }
  console.log(`  written: ${written} document(s)`);
  await db.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
