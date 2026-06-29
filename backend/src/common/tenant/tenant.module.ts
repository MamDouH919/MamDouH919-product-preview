import { Global, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Connection } from 'mongoose';
import { TenantConnectionService } from '../helpers/dynamic-connection';

export const TENANT_CONNECTION = 'TENANT_CONNECTION';

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
  ],
  exports: [TENANT_CONNECTION, TenantConnectionService],
})
export class TenantModule {}
