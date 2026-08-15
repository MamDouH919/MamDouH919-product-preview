import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    tenantModelProvider(Product.name, ProductSchema),
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
