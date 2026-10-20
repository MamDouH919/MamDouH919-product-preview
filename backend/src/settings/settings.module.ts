import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Setting, SettingSchema } from './schemas/setting.schema';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { MailSettingsController } from './mail-settings.controller';
import { PriceListModule } from '../price-list/price-list.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule, MailModule, PriceListModule],
  controllers: [SettingsController, MailSettingsController],
  providers: [
    SettingsService,
    tenantModelProvider(Setting.name, SettingSchema),
    // Read-only here: whether the caller may change the country.
    tenantModelProvider(User.name, UserSchema),
    // Read-only here: whether the store has orders, which freezes its currency.
    tenantModelProvider(Order.name, OrderSchema),
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
