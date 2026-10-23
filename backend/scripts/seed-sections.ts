/**
 * Creates the storefront home-page sections with demo content.
 *
 *   npm run seed:sections -- <host>            # create the ones that are missing
 *   npm run seed:sections -- <host> --reset    # overwrite them with the demo content
 *
 * Sections are matched by `sectionName`, the key the storefront looks them up
 * by, so without `--reset` anything an admin already edited is left alone.
 */
import 'dotenv/config';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { Section, SectionSchema, SectionType } from '../src/sections/schemas/section.schema';

const img = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const SECTIONS = [
  {
    sectionName: 'home-story',
    type: SectionType.DEFAULT,
    image: img('home-story', 900, 1100),
    title: {
      en: 'Crafted for people who care about the details',
      ar: 'مصنوع لمن يهتم بأدق التفاصيل',
    },
    description: {
      en: '<p>Every product in our store is picked by hand, tested, and packed with care. We work directly with makers we trust so you get better quality at a fair price.</p><ul><li>Hand-picked, quality-checked products</li><li>Fast delivery to your door</li><li>Easy returns, no questions asked</li></ul>',
      ar: '<p>كل منتج في متجرنا بنختاره بعناية، ونجربه، ونغلفه باهتمام. بنتعامل مباشرة مع صناع بنثق فيهم علشان توصلك جودة أعلى بسعر مناسب.</p><ul><li>منتجات مختارة ومفحوصة الجودة</li><li>توصيل سريع لحد باب البيت</li><li>استرجاع سهل من غير أسئلة</li></ul>',
    },
  },
  {
    sectionName: 'home-stats',
    type: SectionType.HIGHLIGHTS,
    title: { en: 'Numbers that speak for us', ar: 'أرقام بتتكلم عننا' },
    description: {
      en: 'Thousands of customers trust us every month. Here is what that looks like.',
      ar: 'آلاف العملاء بيثقوا فينا كل شهر. ودي الصورة بالأرقام.',
    },
    highlights: [
      { key: { en: 'Happy customers', ar: 'عميل سعيد' }, value: '12,500+' },
      { key: { en: 'Products', ar: 'منتج' }, value: '850+' },
      { key: { en: 'Average rating', ar: 'متوسط التقييم' }, value: '4.9' },
      { key: { en: 'Cities we deliver to', ar: 'مدينة بنوصل لها' }, value: '27' },
    ],
  },
  {
    sectionName: 'home-gallery',
    type: SectionType.GALLERY,
    title: { en: 'Moments from our community', ar: 'لحظات من مجتمعنا' },
    description: {
      en: '<p>Real photos shared by our customers.</p>',
      ar: '<p>صور حقيقية شاركها عملاؤنا.</p>',
    },
    gallery: [1, 2, 3, 4, 5, 6, 7].map((n) => img(`home-gallery-${n}`, 1000, 1000)),
  },
  {
    sectionName: 'home-cta',
    type: SectionType.LINKS,
    image: img('home-cta', 900, 900),
    title: { en: 'Your next favourite thing is one click away', ar: 'حاجتك المفضلة الجاية على بعد ضغطة' },
    description: {
      en: '<p>Browse the full collection and get free delivery on your first order.</p>',
      ar: '<p>تصفح المجموعة كاملة واستمتع بتوصيل مجاني على أول طلب.</p>',
    },
    links: [
      { label: { en: 'Shop now', ar: 'تسوق الآن' }, url: '/products' },
      { label: { en: 'Browse categories', ar: 'تصفح الأقسام' }, url: '/categories' },
    ],
  },
];

async function main() {
  const [host, flag] = process.argv.slice(2);
  if (!host) throw new Error('Usage: npm run seed:sections -- <host> [--reset]');
  const reset = flag === '--reset';

  // Same tenant lookup the app does at boot: the platform registry when
  // PLATFORM_MONGO_URL is set, otherwise TENANT_MAP / src/config.json.
  const tenants = new TenantConnectionService();
  await tenants.onModuleInit();
  if (!tenants.getHosts().includes(host)) {
    throw new Error(`Unknown tenant "${host}". Known hosts: ${tenants.getHosts().join(', ') || 'none'}`);
  }
  const db = await tenants.getConnection(host);
  const sectionModel = db.model(Section.name, SectionSchema);

  for (const { sectionName, ...content } of SECTIONS) {
    const exists = await sectionModel.exists({ sectionName });
    if (exists && !reset) {
      console.log(`${sectionName}: already exists, left as it is`);
      continue;
    }
    await sectionModel.findOneAndUpdate(
      { sectionName },
      { $set: content },
      { upsert: true, returnDocument: 'after' },
    );
    console.log(`${sectionName}: ${exists ? 'reset' : 'created'}`);
  }

  await db.close();
  await tenants.onModuleDestroy();
}

main().catch((err) => {
  console.error('Seeding sections failed:', err);
  process.exit(1);
});
