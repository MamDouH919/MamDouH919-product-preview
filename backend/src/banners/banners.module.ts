import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [BannersController],
  providers: [BannersService, tenantModelProvider(Banner.name, BannerSchema)],
})
export class BannersModule {}
