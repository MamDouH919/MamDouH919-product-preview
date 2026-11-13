import { Module } from '@nestjs/common';
import { PlatformAuthController, PlatformBackupsController, PlatformErrorsController, PlatformPriceChangesController, PlatformTenantsController } from './platform.controller';
import { BackupModule } from '../backup/backup.module';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsService } from './platform-tenants.service';

/**
 * The platform dashboard's API: one admin from the environment manages the
 * tenant registry (TenantConnectionService, from the global TenantModule).
 */
@Module({
  imports: [BackupModule],
  controllers: [PlatformAuthController, PlatformTenantsController, PlatformBackupsController, PlatformErrorsController, PlatformPriceChangesController],
  providers: [PlatformAuthService, PlatformTenantsService],
})
export class PlatformModule {}
