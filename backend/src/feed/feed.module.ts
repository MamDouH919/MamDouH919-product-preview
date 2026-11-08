import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { SubCategory, SubCategorySchema } from '../sub-categories/schemas/sub-category.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  controllers: [FeedController],
  providers: [
    FeedService,
    tenantModelProvider(Product.name, ProductSchema),
    // Registered so `populate` can resolve them on the tenant's connection.
    tenantModelProvider(Category.name, CategorySchema),
    tenantModelProvider(SubCategory.name, SubCategorySchema),
  ],
})
export class FeedModule {}
