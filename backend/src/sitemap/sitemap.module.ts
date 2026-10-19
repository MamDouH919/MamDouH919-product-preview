import { Module } from '@nestjs/common';
import { SitemapService } from './sitemap.service';
import { SitemapController } from './sitemap.controller';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Page, PageSchema } from '../pages/schemas/page.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  controllers: [SitemapController],
  providers: [
    SitemapService,
    tenantModelProvider(Product.name, ProductSchema),
    tenantModelProvider(Category.name, CategorySchema),
    tenantModelProvider(Page.name, PageSchema),
  ],
})
export class SitemapModule {}
