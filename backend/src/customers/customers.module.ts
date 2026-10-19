import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  CustomerProfileController,
  CustomersController,
} from './customers.controller';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { AuthModule } from '../auth/auth.module';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { PriceListModule } from '../price-list/price-list.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule, PriceListModule],
  // Order matters: Nest matches routes in registration order, and
  // `GET /customers/:id` would otherwise swallow `GET /customers/me` and treat
  // "me" as an id.
  controllers: [CustomerProfileController, CustomersController],
  providers: [
    CustomersService,
    CustomerAuthGuard,
    tenantModelProvider(Customer.name, CustomerSchema),
    tenantModelProvider(Product.name, ProductSchema),
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
