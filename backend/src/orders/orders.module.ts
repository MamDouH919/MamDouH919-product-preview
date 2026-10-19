import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CustomerOrdersController,
  GuestOrdersController,
  OrderQuoteController,
  OrdersController,
} from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomersModule } from '../customers/customers.module';
import { CouponsModule } from '../coupons/coupons.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { MailModule } from '../mail/mail.module';
import { OrderNotificationsService } from './order-notifications.service';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { PriceListModule } from '../price-list/price-list.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
    CustomersModule,
    CustomerAuthModule,
    CouponsModule,
    PriceListModule,
    MailModule,
  ],
  // Order matters: `/orders/quote`, `/orders/guest` and `/orders/me` must
  // register before `GET /orders/:id`, or "me" would be read as an order id.
  controllers: [
    OrderQuoteController,
    GuestOrdersController,
    CustomerOrdersController,
    OrdersController,
  ],
  providers: [
    OrdersService,
    OrderNotificationsService,
    CustomerAuthGuard,
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Counter.name, CounterSchema),
    tenantModelProvider(Product.name, ProductSchema),
    tenantModelProvider(Setting.name, SettingSchema),
  ],
})
export class OrdersModule {}
