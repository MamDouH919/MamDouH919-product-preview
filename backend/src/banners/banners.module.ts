import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]),
    AuthModule,
  ],
  controllers: [BannersController],
  providers: [BannersService],
})
export class BannersModule {}
