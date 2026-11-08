/**
 * Creates the shipping and returns policy pages from the store's settings.
 *
 *   npm run seed:policies -- <host>            # create the ones that are missing
 *   npm run seed:policies -- <host> --reset    # rewrite them from the template
 *
 * Pages are matched by slug (`shipping-policy`, `return-policy`), so without
 * `--reset` a page the store already edited is left alone. Fill in the
 * store's settings first (return window, delivery fee, phone, WhatsApp,
 * email): the text is written from them, and re-running with --reset after
 * changing them brings the pages up to date.
 */
import 'dotenv/config';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { Page, PageSchema } from '../src/pages/schemas/page.schema';
import { Setting, SettingSchema } from '../src/settings/schemas/setting.schema';
import { buildPolicyPages } from '../src/pages/policy-templates';
import { StoreModule } from '../src/common/tenant/store-plan';

async function main() {
  const [host, flag] = process.argv.slice(2);
  if (!host) throw new Error('Usage: npm run seed:policies -- <host> [--reset]');
  const reset = flag === '--reset';

  // Same tenant lookup the app does at boot: the platform registry when
  // PLATFORM_MONGO_URL is set, otherwise TENANT_MAP / src/config.json.
  const tenants = new TenantConnectionService();
  await tenants.onModuleInit();
  if (!tenants.getHosts().includes(host)) {
    throw new Error(`Unknown tenant "${host}". Known hosts: ${tenants.getHosts().join(', ') || 'none'}`);
  }
  const db = await tenants.getConnection(host);
  const pageModel = db.model(Page.name, PageSchema);
  const settingModel = db.model(Setting.name, SettingSchema);

  const settings: any = (await settingModel.findOne().lean().exec()) ?? {};
  const pages = buildPolicyPages({
    storeName: settings.siteTitle,
    country: settings.country,
    currency: settings.currency,
    flatDeliveryPrice: settings.flatDeliveryPrice,
    returnWindowDays: settings.returnWindowDays,
    deliveryFeeRefund: settings.finance?.deliveryFeeRefund,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    sellsOnline: tenants.hasModule(host, StoreModule.ORDERS),
  });

  for (const { slug, ...content } of pages) {
    const exists = await pageModel.exists({ slug });
    if (exists && !reset) {
      console.log(`${slug}: already exists, left as it is (use --reset to rewrite it)`);
      continue;
    }
    await pageModel.findOneAndUpdate({ slug }, { $set: content }, { upsert: true, returnDocument: 'after' });
    console.log(`${slug}: ${exists ? 'rewritten from the template' : 'created'}`);
  }

  await db.close();
  await tenants.onModuleDestroy();
}

main().catch((err) => {
  console.error('Seeding policy pages failed:', err);
  process.exit(1);
});
