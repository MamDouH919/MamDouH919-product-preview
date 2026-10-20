import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { tenantSchemas } from '../../src/common/tenant/tenant-schemas';

/**
 * A throwaway single-node replica set — real transactions, like production,
 * and nothing touched on the developer's own MongoDB.
 */
export async function startReplSet(): Promise<MongoMemoryReplSet> {
  return MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
}

/**
 * A tenant connection the way `TenantConnectionService` builds one: its own
 * client, its own database, every tenant schema registered on it.
 */
export async function tenantConnection(server: { getUri(db?: string): string }, db: string): Promise<Connection> {
  const connection = await mongoose.createConnection(server.getUri(db)).asPromise();
  for (const { name, schema } of tenantSchemas) connection.model(name, schema);
  // Transactions can't create collections on older servers; make them up front, as boot does.
  await Promise.all(connection.modelNames().map((name) => connection.model(name).createCollection()));
  return connection;
}
