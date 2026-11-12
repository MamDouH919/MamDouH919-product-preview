import { Global, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Connection } from 'mongoose';
import { TenantConnectionService } from '../helpers/dynamic-connection';
import { StoreModule } from './store-plan';

export const TENANT_CONNECTION = 'TENANT_CONNECTION';

/**
 * The modules the requesting store's plan has, for services whose work
 * changes with the plan (an order takes stock and books the sale only when
 * the store has those modules). Routes are gated by `@RequireModules`.
 */
export const STORE_MODULES = 'STORE_MODULES';

/** How many warehouses the requesting store's platform allowance lets it keep. */
export const MAX_WAREHOUSES = 'MAX_WAREHOUSES';

@Global()
@Module({
  providers: [
    TenantConnectionService,
    {
      provide: TENANT_CONNECTION,
      scope: Scope.REQUEST,
      useFactory: (
        req: Request,
        tenantConnection: TenantConnectionService,
      ): Promise<Connection> =>
        tenantConnection.getConnection(req['tenant'] ?? req.hostname),
      inject: [REQUEST, TenantConnectionService],
    },
    {
      provide: STORE_MODULES,
      scope: Scope.REQUEST,
      useFactory: (req: Request, tenantConnection: TenantConnectionService): readonly StoreModule[] =>
        tenantConnection.getModules(req['tenant'] ?? req.hostname),
      inject: [REQUEST, TenantConnectionService],
    },
    {
      provide: MAX_WAREHOUSES,
      scope: Scope.REQUEST,
      useFactory: (req: Request, tenantConnection: TenantConnectionService): number =>
        tenantConnection.getMaxWarehouses(req['tenant'] ?? req.hostname),
      inject: [REQUEST, TenantConnectionService],
    },
  ],
  exports: [TENANT_CONNECTION, STORE_MODULES, MAX_WAREHOUSES, TenantConnectionService],
})
export class TenantModule {}
