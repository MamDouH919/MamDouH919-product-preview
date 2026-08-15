import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TenantConnectionService } from '../src/common/helpers/dynamic-connection';
import { Product, ProductSchema } from '../src/products/schemas/product.schema';

/**
 * Backfills the inventory fields on products that existed before stock
 * tracking was added.
 *
 * Variants used to be stored with `_id: false`, so every existing variant is
 * missing the id that stock movements reference. Re-saving each product makes
 * Mongoose mint one. This is safe to run more than once — variants that
 * already have an id keep it.
 *
 *   npm run migrate:inventory -- <host>
 */
async function migrate() {
  const host = process.argv[2] ?? process.env.TENANT_HOST;
  if (!host) {
    throw new Error(
      'No tenant host provided. Usage: npm run migrate:inventory -- <host>',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantConnection = app.get(TenantConnectionService);
  const connection = await tenantConnection.getConnection(host);
  const productModel = connection.model(Product.name, ProductSchema);

  console.log(`Migrating inventory fields for "${host}"...`);

  // Defaults for the product-level fields. `$exists: false` keeps this from
  // resetting anything already migrated.
  const defaults: [string, unknown][] = [
    ['trackStock', true],
    ['stock', 0],
    ['lowStockThreshold', 0],
    ['allowBackorder', false],
  ];

  for (const [field, value] of defaults) {
    const result = await productModel.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: value } },
    );
    console.log(`  ${field}: ${result.modifiedCount} product(s) set to ${String(value)}`);
  }

  // Variant ids + variant stock. Reading and re-saving is what triggers
  // Mongoose to assign the missing `_id`s.
  const products = await productModel.find({ 'variants.0': { $exists: true } }).exec();

  let touched = 0;
  for (const product of products) {
    let changed = false;

    for (const variant of product.variants) {
      if (variant.stock === undefined || variant.stock === null) {
        variant.stock = 0;
        changed = true;
      }
      if (!variant._id) changed = true; // Mongoose assigns one on save
    }

    if (changed) {
      product.markModified('variants');
      await product.save();
      touched++;
    }
  }

  console.log(`  variants: ${touched} product(s) updated`);

  await app.close();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
