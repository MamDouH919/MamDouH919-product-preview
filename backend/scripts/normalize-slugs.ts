/**
 * Rewrites product slugs into the form the dashboard now requires: lowercase
 * English letters, numbers and single hyphens ("Velvet-coffe" → "velvet-coffe").
 * Each old slug is kept in `previousSlugs`, so its links still find the product
 * and the storefront redirects them (308, permanent) to the new one.
 *
 *   npm run normalize-slugs -- <host>                                   # report what would change
 *   npm run normalize-slugs -- <host> --apply                           # write it
 *   npm run normalize-slugs -- <host> --rename Velvet-coffe=velvet-coffee --apply
 *
 * `--rename old=new` (repeatable) gives a product a slug of your choosing, for
 * a typo the lowercasing alone won't fix. Safe to run again: a second run
 * finds nothing to do. A slug another product already uses is reported and
 * skipped, never overwritten.
 */
import 'dotenv/config';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { Product, ProductSchema } from '../src/products/schemas/product.schema';

const VALID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same rules as the dashboard's slug field. */
function normalize(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function run() {
  const args = process.argv.slice(2);
  const host = args.find((a) => !a.startsWith('--') && !a.includes('='));
  const apply = args.includes('--apply');
  if (!host) throw new Error('Usage: npm run normalize-slugs -- <host> [--rename old=new ...] [--apply]');

  const renames = new Map<string, string>();
  args.forEach((a, i) => {
    if (a !== '--rename') return;
    const [from, to] = (args[i + 1] ?? '').split('=');
    if (!from || !to || !VALID.test(to)) throw new Error(`--rename needs old=new, with new a valid slug: "${args[i + 1]}"`);
    renames.set(from, to);
  });

  // Same tenant lookup the app does at boot: the platform registry when
  // PLATFORM_MONGO_URL is set, otherwise TENANT_MAP / src/config.json.
  const tenants = new TenantConnectionService();
  await tenants.onModuleInit();
  if (!tenants.getHosts().includes(host)) {
    throw new Error(`Unknown tenant "${host}". Known hosts: ${tenants.getHosts().join(', ') || 'none'}`);
  }
  const db = await tenants.getConnection(host);
  const products = db.model(Product.name, ProductSchema);

  const all = await products.find().select('slug previousSlugs').lean().exec();
  const taken = new Set(all.map((p) => p.slug));
  console.log(`${host}: ${all.length} product(s)${apply ? '' : ' (dry run: add --apply to write)'}`);

  let changed = 0;
  for (const p of all) {
    const target = renames.get(p.slug) ?? normalize(p.slug);
    if (!target || target === p.slug) continue;
    if (taken.has(target)) {
      console.log(`  skip  ${p.slug} → ${target}: another product already has that slug`);
      continue;
    }
    console.log(`  ${apply ? 'move' : 'would move'}  ${p.slug} → ${target}`);
    if (apply) {
      const previousSlugs = [...new Set([...(p.previousSlugs ?? []), p.slug])].filter((s) => s !== target);
      await products.updateOne({ _id: p._id }, { $set: { slug: target, previousSlugs } }).exec();
    }
    taken.delete(p.slug);
    taken.add(target);
    changed++;
  }

  for (const from of renames.keys()) {
    if (!all.some((p) => p.slug === from)) console.log(`  --rename ${from}: no product has this slug`);
  }
  console.log(`${changed} slug(s) ${apply ? 'changed' : 'to change'}.`);
  await db.close();
  await tenants.onModuleDestroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
