import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { SubCategory, SubCategorySchema } from '../sub-categories/schemas/sub-category.schema';
import { ProductCsvService } from './product-csv.service';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductCsvService,
    tenantModelProvider(Product.name, ProductSchema),
    // Read-only here: what tends to be bought together, for related products.
    tenantModelProvider(Order.name, OrderSchema),
    // Read-only here: resolving category and sub-category names in CSV imports.
    tenantModelProvider(Category.name, CategorySchema),
    tenantModelProvider(SubCategory.name, SubCategorySchema),
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
