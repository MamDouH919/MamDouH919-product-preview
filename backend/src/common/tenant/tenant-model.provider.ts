import { Provider, Scope } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Connection, Schema } from 'mongoose';
import { TENANT_CONNECTION } from './tenant.module';

/**
 * Builds a request-scoped model provider bound to the current tenant's
 * connection. It registers under the same token `@InjectModel(name)` uses,
 * so existing services keep working without changes.
 */
export function tenantModelProvider(name: string, schema: Schema): Provider {
  return {
    provide: getModelToken(name),
    scope: Scope.REQUEST,
    useFactory: (conn: Connection) =>
      conn.models[name] || conn.model(name, schema),
    inject: [TENANT_CONNECTION],
  };
}
