/**
 * Fills a store with demo categories, sub-categories and random products.
 *
 *   npm run seed:products -- <host>               # 50 products
 *   npm run seed:products -- <host> 200           # 200 products
 *   npm run seed:products -- <host> 50 --reset    # remove earlier demo products first
 *
 * Categories and sub-categories are upserted by slug, so running it again
 * only adds products. Every product it makes is tagged `seed`, which is what
 * `--reset` removes — products added by hand are never touched.
 */
import 'dotenv/config';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { Category, CategorySchema } from '../src/categories/schemas/category.schema';
import { SubCategory, SubCategorySchema } from '../src/sub-categories/schemas/sub-category.schema';
import { Product, ProductSchema } from '../src/products/schemas/product.schema';

const SEED_TAG = 'seed';

type Name = { en: string; ar: string };

const CATALOG: { name: Name; slug: string; subs: { name: Name; slug: string; items: Name[] }[] }[] = [
  {
    name: { en: 'Electronics', ar: 'إلكترونيات' },
    slug: 'electronics',
    subs: [
      {
        name: { en: 'Phones', ar: 'هواتف' },
        slug: 'phones',
        items: [
          { en: 'Smartphone', ar: 'هاتف ذكي' },
          { en: 'Phone Case', ar: 'جراب هاتف' },
          { en: 'Fast Charger', ar: 'شاحن سريع' },
        ],
      },
      {
        name: { en: 'Audio', ar: 'صوتيات' },
        slug: 'audio',
        items: [
          { en: 'Wireless Earbuds', ar: 'سماعات لاسلكية' },
          { en: 'Bluetooth Speaker', ar: 'مكبر صوت بلوتوث' },
          { en: 'Headphones', ar: 'سماعات رأس' },
        ],
      },
    ],
  },
  {
    name: { en: 'Fashion', ar: 'أزياء' },
    slug: 'fashion',
    subs: [
      {
        name: { en: 'Men', ar: 'رجالي' },
        slug: 'men',
        items: [
          { en: 'Cotton T-Shirt', ar: 'تيشيرت قطن' },
          { en: 'Denim Jeans', ar: 'بنطلون جينز' },
          { en: 'Leather Jacket', ar: 'جاكيت جلد' },
        ],
      },
      {
        name: { en: 'Women', ar: 'حريمي' },
        slug: 'women',
        items: [
          { en: 'Summer Dress', ar: 'فستان صيفي' },
          { en: 'Handbag', ar: 'حقيبة يد' },
          { en: 'Silk Scarf', ar: 'وشاح حرير' },
        ],
      },
    ],
  },
  {
    name: { en: 'Home & Kitchen', ar: 'المنزل والمطبخ' },
    slug: 'home-kitchen',
    subs: [
      {
        name: { en: 'Cookware', ar: 'أدوات الطهي' },
        slug: 'cookware',
        items: [
          { en: 'Frying Pan', ar: 'مقلاة' },
          { en: 'Cooking Pot', ar: 'حلة طبخ' },
          { en: 'Knife Set', ar: 'طقم سكاكين' },
        ],
      },
      {
        name: { en: 'Decor', ar: 'ديكور' },
        slug: 'decor',
        items: [
          { en: 'Table Lamp', ar: 'أباجورة' },
          { en: 'Wall Clock', ar: 'ساعة حائط' },
          { en: 'Cushion', ar: 'وسادة' },
        ],
      },
    ],
  },
  {
    name: { en: 'Beauty', ar: 'الجمال' },
    slug: 'beauty',
    subs: [
      {
        name: { en: 'Skincare', ar: 'العناية بالبشرة' },
        slug: 'skincare',
        items: [
          { en: 'Face Cream', ar: 'كريم وجه' },
          { en: 'Serum', ar: 'سيروم' },
          { en: 'Sunscreen', ar: 'واقي شمس' },
        ],
      },
      {
        name: { en: 'Fragrance', ar: 'عطور' },
        slug: 'fragrance',
        items: [
          { en: 'Eau de Parfum', ar: 'عطر' },
          { en: 'Body Mist', ar: 'معطر جسم' },
          { en: 'Oud Oil', ar: 'دهن عود' },
        ],
      },
    ],
  },
  {
    name: { en: 'Sports', ar: 'رياضة' },
    slug: 'sports',
    subs: [
      {
        name: { en: 'Fitness', ar: 'لياقة' },
        slug: 'fitness',
        items: [
          { en: 'Yoga Mat', ar: 'سجادة يوغا' },
          { en: 'Dumbbells', ar: 'دمبلز' },
          { en: 'Resistance Band', ar: 'حبل مقاومة' },
        ],
      },
      {
        name: { en: 'Outdoor', ar: 'أنشطة خارجية' },
        slug: 'outdoor',
        items: [
          { en: 'Water Bottle', ar: 'زجاجة مياه' },
          { en: 'Backpack', ar: 'حقيبة ظهر' },
          { en: 'Camping Tent', ar: 'خيمة تخييم' },
        ],
      },
    ],
  },
];

const ADJECTIVES: Name[] = [
  { en: 'Premium', ar: 'فاخر' },
  { en: 'Classic', ar: 'كلاسيكي' },
  { en: 'Modern', ar: 'عصري' },
  { en: 'Pro', ar: 'احترافي' },
  { en: 'Eco', ar: 'صديق للبيئة' },
  { en: 'Deluxe', ar: 'ديلوكس' },
];

const VARIANT_SETS = [
  ['S', 'M', 'L', 'XL'],
  ['Black', 'White', 'Blue'],
  ['250ml', '500ml'],
];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const between = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const suffix = () => Math.random().toString(36).slice(2, 8);

async function main() {
  const [host, countArg, flag] = process.argv.slice(2);
  if (!host) throw new Error('Usage: npm run seed:products -- <host> [count] [--reset]');
  const count = Number(countArg ?? 50);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid count: ${countArg}`);

  // Same tenant lookup the app does at boot: the platform registry when
  // PLATFORM_MONGO_URL is set, otherwise TENANT_MAP / src/config.json.
  const tenants = new TenantConnectionService();
  await tenants.onModuleInit();
  if (!tenants.getHosts().includes(host)) {
    throw new Error(`Unknown tenant "${host}". Known hosts: ${tenants.getHosts().join(', ') || 'none'}`);
  }
  const db = await tenants.getConnection(host);
  const categoryModel = db.model(Category.name, CategorySchema);
  const subCategoryModel = db.model(SubCategory.name, SubCategorySchema);
  const productModel = db.model(Product.name, ProductSchema);

  if (flag === '--reset') {
    const { deletedCount } = await productModel.deleteMany({ tags: SEED_TAG });
    console.log(`Removed ${deletedCount} demo products`);
  }

  // Upsert the tree, keeping what each leaf can sell.
  const leaves: { category: Category; sub: SubCategory; items: Name[] }[] = [];
  for (const [i, c] of CATALOG.entries()) {
    const category = await categoryModel.findOneAndUpdate(
      { slug: c.slug },
      { $setOnInsert: { name: c.name, slug: c.slug, order: i, isActive: true } },
      { upsert: true, returnDocument: 'after' },
    );
    for (const [j, s] of c.subs.entries()) {
      const sub = await subCategoryModel.findOneAndUpdate(
        { slug: s.slug },
        { $setOnInsert: { name: s.name, slug: s.slug, category: category._id, order: j, isActive: true } },
        { upsert: true, returnDocument: 'after' },
      );
      leaves.push({ category, sub, items: s.items });
    }
  }
  console.log(`${CATALOG.length} categories, ${leaves.length} sub-categories ready`);

  const products = Array.from({ length: count }, () => {
    const leaf = pick(leaves);
    const item = pick(leaf.items);
    const adj = pick(ADJECTIVES);
    const name = { en: `${adj.en} ${item.en}`, ar: `${item.ar} ${adj.ar}` };
    const slug = `${name.en.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix()}`;
    const price = between(5, 500);
    const variants =
      Math.random() < 0.3
        ? pick(VARIANT_SETS).map((label) => ({
            label,
            price: price + between(0, 50),
            sku: `${slug}-${label}`.toUpperCase(),
            stock: between(0, 40),
          }))
        : [];

    return {
      name,
      shortDescription: {
        en: `${name.en} from our ${leaf.sub.name.en} collection.`,
        ar: `${name.ar} من مجموعة ${leaf.sub.name.ar}.`,
      },
      description: {
        en: `A ${adj.en.toLowerCase()} ${item.en.toLowerCase()} built to last. Great quality at a fair price.`,
        ar: `${item.ar} ${adj.ar} بجودة عالية وسعر مناسب.`,
      },
      images: [1, 2].map((n) => `https://picsum.photos/seed/${slug}-${n}/800/800`),
      price,
      sku: `SKU-${suffix().toUpperCase()}`,
      category: leaf.category._id,
      subCategory: leaf.sub._id,
      slug,
      tags: [SEED_TAG, leaf.category.slug, leaf.sub.slug],
      variants,
      stock: variants.length ? 0 : between(0, 100),
      lowStockThreshold: 5,
      isActive: true,
    };
  });

  await productModel.insertMany(products);
  console.log(`Created ${products.length} products`);
  await db.close();
  await tenants.onModuleDestroy();
}

main().catch((err) => {
  console.error('Seeding products failed:', err);
  process.exit(1);
});
