import { Module } from '@nestjs/common';
import { SubscribeService } from './subscribe.service';
import { SubscribeController } from './subscribe.controller';
import { Subscribe, SubscribeSchema } from './schemas/subscribe.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [SubscribeController],
  providers: [
    SubscribeService,
    tenantModelProvider(Subscribe.name, SubscribeSchema),
  ],
})
export class SubscribeModule {}
