import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CustomerReturnsController, ReturnsController } from './returns.controller';
import { ReturnNotificationsService } from './return-notifications.service';
import { ReturnRequest, ReturnRequestSchema } from './schemas/return-request.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Counter, CounterSchema } from '../orders/schemas/counter.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MailModule } from '../mail/mail.module';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule, InventoryModule, MailModule],
  // Customer routes first, so `returns/me/...` is never read as a return id.
  controllers: [CustomerReturnsController, ReturnsController],
  providers: [
    ReturnsService,
    ReturnNotificationsService,
    CustomerAuthGuard,
    tenantModelProvider(ReturnRequest.name, ReturnRequestSchema),
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Counter.name, CounterSchema),
    tenantModelProvider(Customer.name, CustomerSchema),
    tenantModelProvider(Product.name, ProductSchema),
    tenantModelProvider(Setting.name, SettingSchema),
  ],
})
export class ReturnsModule {}
