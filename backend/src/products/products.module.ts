import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    tenantModelProvider(Product.name, ProductSchema),
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
