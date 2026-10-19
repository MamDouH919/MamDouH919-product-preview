import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController, CartRemindersController } from './cart.controller';
import { CartReminderWorker } from './cart-reminder.worker';
import { CartReminderScheduler } from './cart-reminder.scheduler';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { MailModule } from '../mail/mail.module';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [MailModule],
  controllers: [CartController, CartRemindersController],
  providers: [
    CartService,
    CartReminderWorker,
    CartReminderScheduler,
    CustomerAuthGuard,
    tenantModelProvider(Customer.name, CustomerSchema),
    tenantModelProvider(Product.name, ProductSchema),
    // Read-only here: skipping customers who ordered after their cart changed.
    tenantModelProvider(Order.name, OrderSchema),
    tenantModelProvider(Setting.name, SettingSchema),
  ],
})
export class CartModule {}
