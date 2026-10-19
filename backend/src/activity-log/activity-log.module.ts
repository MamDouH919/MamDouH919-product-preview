import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogInterceptor } from './activity-log.interceptor';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-log.schema';
import { AuthModule } from '../auth/auth.module';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule],
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    tenantModelProvider(ActivityLog.name, ActivityLogSchema),
    // Global, so every admin write anywhere in the app is recorded without per-module wiring.
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
})
export class ActivityLogModule {}
