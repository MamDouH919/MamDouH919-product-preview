import { Module } from '@nestjs/common';
import { PriceListService } from './price-list.service';
import { DeliveryAreasController, PriceListController } from './price-list.controller';
import { Zone, ZoneSchema, SubZone, SubZoneSchema } from './schemas/zone.schema';
import { DeliveryPrice, DeliveryPriceSchema } from './schemas/delivery-price.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [DeliveryAreasController, PriceListController],
  providers: [
    PriceListService,
    tenantModelProvider(Zone.name, ZoneSchema),
    tenantModelProvider(SubZone.name, SubZoneSchema),
    tenantModelProvider(DeliveryPrice.name, DeliveryPriceSchema),
    // Read-only here: which country the store picked.
    tenantModelProvider(Setting.name, SettingSchema),
  ],
  exports: [PriceListService],
})
export class PriceListModule {}
