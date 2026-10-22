import { Module } from '@nestjs/common';
import { PlatformAuthController, PlatformTenantsController } from './platform.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformTenantsService } from './platform-tenants.service';

/**
 * The platform dashboard's API: one admin from the environment manages the
 * tenant registry (TenantConnectionService, from the global TenantModule).
 */
@Module({
  controllers: [PlatformAuthController, PlatformTenantsController],
  providers: [PlatformAuthService, PlatformTenantsService],
})
export class PlatformModule {}
