/**
 * Converts ids stored as strings into real ObjectIds, in every field a
 * schema declares as one — without changing any id's value.
 *
 *   npm run normalize-ids -- <host>            # report what would change
 *   npm run normalize-ids -- <host> --apply    # write it, in one transaction
 *
 * Why: schemas used to declare ids as `Types.ObjectId`, which @nestjs/mongoose
 * silently turns into Mixed — so an id passed as a string was stored as one,
 * and a query using an ObjectId (or, since the fix, any query, which now
 * casts) misses it. Take a backup first (`mongodump --db <store db>`).
 * Safe to run again: a second run finds nothing to do.
 */
import { Connection, Schema, Types } from 'mongoose';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { withTransaction } from '../src/common/tenant/with-transaction';

const HEX_ID = /^[0-9a-f]{24}$/i;

/**
 * A copy of `value` with every string id in an ObjectId path of `schema`
 * turned into an ObjectId, and how many it turned. Recurses into nested
 * documents and arrays of them.
 */
function fix(value: unknown, schema: Schema, prefix = ''): { value: unknown; changed: string[] } {
  if (!value || typeof value !== 'object' || value instanceof Types.ObjectId || value instanceof Date) {
    return { value, changed: [] };
  }
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  const changed: string[] = [];
  for (const [key, v] of Object.entries(out)) {
    const path = schema.path(key) as unknown as
      | { instance?: string; caster?: { instance?: string }; schema?: Schema; embeddedSchemaType?: { instance?: string } }
      | undefined;
    if (!path) continue;
    const at = prefix + key;
    if (path.instance === 'ObjectId' && typeof v === 'string' && HEX_ID.test(v)) {
      out[key] = new Types.ObjectId(v);
      changed.push(at);
    } else if (path.instance === 'Array' && Array.isArray(v)) {
      const itemIsId = path.caster?.instance === 'ObjectId' || path.embeddedSchemaType?.instance === 'ObjectId';
      out[key] = v.map((item, i) => {
        if (itemIsId && typeof item === 'string' && HEX_ID.test(item)) {
          changed.push(`${at}[]`);
          return new Types.ObjectId(item);
        }
        if (path.schema && item && typeof item === 'object') {
          const inner = fix(item, path.schema, `${at}[${i}].`);
          changed.push(...inner.changed.map((c) => c.replace(/\[\d+\]/g, '[]')));
          return inner.value;
        }
        return item;
      });
    } else if (path.schema && v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = fix(v, path.schema, `${at}.`);
      out[key] = inner.value;
      changed.push(...inner.changed);
    }
  }
  return { value: out, changed };
}

async function plan(db: Connection) {
  const updates: { collection: string; _id: unknown; set: Record<string, unknown> }[] = [];
  const counts = new Map<string, number>();
  for (const name of db.modelNames()) {
    const model = db.model(name);
    for (const doc of await model.collection.find({}).toArray()) {
      const { value, changed } = fix(doc, model.schema);
      if (!changed.length) continue;
      // Rewrite only the top-level fields that held a string id.
      const top = [...new Set(changed.map((c) => c.split(/[.[]/)[0]))];
      updates.push({ collection: model.collection.collectionName, _id: doc._id, set: Object.fromEntries(top.map((k) => [k, (value as Record<string, unknown>)[k]])) });
      for (const c of changed) counts.set(`${model.collection.collectionName}.${c}`, (counts.get(`${model.collection.collectionName}.${c}`) ?? 0) + 1);
    }
  }
  return { updates, counts };
}

async function main() {
  const [host, flag] = process.argv.slice(2);
  if (!host) throw new Error('Usage: npm run normalize-ids -- <host> [--apply]');
  const db = await new TenantConnectionService().getConnection(host);

  const { updates, counts } = await plan(db);
  console.log(`Store ${host} — ${flag === '--apply' ? 'APPLYING' : 'dry run (add --apply to write)'}`);
  if (!updates.length) console.log('  every id is already an ObjectId');
  for (const [path, n] of counts) console.log(`  ${path}: ${n}`);

  if (flag === '--apply' && updates.length) {
    await withTransaction(db, async (session) => {
      for (const u of updates) await db.collection(u.collection).updateOne({ _id: u._id as Types.ObjectId }, { $set: u.set }, { session });
    });
    const after = await plan(db);
    console.log(`  written: ${updates.length} document(s); left as strings: ${after.updates.length}`);
  }
  await db.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
