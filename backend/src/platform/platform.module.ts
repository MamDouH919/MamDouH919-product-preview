import { Module } from '@nestjs/common';
import { PlatformAuthController, PlatformBackupsController, PlatformTenantsController } from './platform.controller';
import { BackupModule } from '../backup/backup.module';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsService } from './platform-tenants.service';

/**
 * The platform dashboard's API: one admin from the environment manages the
 * tenant registry (TenantConnectionService, from the global TenantModule).
 */
@Module({
  imports: [BackupModule],
  controllers: [PlatformAuthController, PlatformTenantsController, PlatformBackupsController],
  providers: [PlatformAuthService, PlatformTenantsService],
})
export class PlatformModule {}
