import { Connection, Model, mongo } from 'mongoose';
import { RefreshToken } from '../auth/schemas/refresh-schema.schema';
import { ResetToken } from '../auth/schemas/reset-token.schema';
import { Otp } from '../auth/schemas/otp.schema';
import { CustomerRefreshToken, CustomerResetToken } from '../customer-auth/schemas/customer-token.schema';
import { tenantSchemas } from '../common/tenant/tenant-schemas';
import { withTransaction } from '../common/tenant/with-transaction';

const { EJSON } = mongo.BSON;

/** Written into every dump; a restore refuses any other shape. */
export const DUMP_FORMAT = 'store-export/1';

/**
 * Live credentials: never dumped (a backup file must not hand out sessions or
 * reset links) and never restored. After a restore everyone signs in again.
 */
const SECRET_MODELS = [
  RefreshToken.name,
  ResetToken.name,
  Otp.name,
  CustomerRefreshToken.name,
  CustomerResetToken.name,
];

/** Most validation errors one report lists. */
const MAX_ERRORS = 20;

export interface RestoreReport {
  dryRun: boolean;
  host: string;
  exportedAt?: string;
  collections: { name: string; documents: number }[];
  /** Collections in the file this system has no model for, or that hold secrets. */
  skipped: string[];
  /** Documents the current schemas reject. Any of these stops a real restore. */
  errors: string[];
  restored: boolean;
}

/** Registers every tenant model on a bare connection, the way TenantConnectionService does. */
export function registerTenantModels(connection: Connection): void {
  for (const { name, schema } of tenantSchemas) {
    if (!connection.modelNames().includes(name)) connection.model(name, schema);
  }
}

/** Collection name → model for everything a dump may hold. */
function dumpableModels(connection: Connection): Map<string, Model<any>> {
  registerTenantModels(connection);
  const models = new Map<string, Model<any>>();
  for (const name of connection.modelNames()) {
    if (SECRET_MODELS.includes(name)) continue;
    const model = connection.model(name);
    models.set(model.collection.collectionName, model);
  }
  return models;
}

/**
 * One store's data as canonical Extended JSON, which keeps ObjectIds, dates
 * and longs as their real types.
 */
export async function dumpStore(connection: Connection, host: string): Promise<string> {
  const collections: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const [name, model] of dumpableModels(connection)) {
    const docs = await model.collection.find({}).toArray();
    collections[name] = docs;
    counts[name] = docs.length;
  }
  return EJSON.stringify(
    { format: DUMP_FORMAT, host, exportedAt: new Date(), counts, collections },
    { relaxed: false },
  );
}

/**
 * Replaces the store's data with a dump of that same store. Every document is
 * validated through its schema first; with `dryRun` (the default) it stops
 * there and returns the report. The write is one transaction: every
 * collection in the file lands, or none does. Collections the file doesn't
 * mention are left alone; secrets (sessions, reset links) are cleared.
 */
export async function restoreStore(
  connection: Connection,
  host: string,
  dump: string,
  { dryRun = true }: { dryRun?: boolean } = {},
): Promise<RestoreReport> {
  let parsed: { format?: string; host?: string; exportedAt?: Date; collections?: Record<string, unknown> };
  try {
    parsed = EJSON.parse(dump, { relaxed: false });
  } catch {
    throw new RestoreError('The backup file is not valid Extended JSON');
  }
  if (parsed?.format !== DUMP_FORMAT || typeof parsed.collections !== 'object' || !parsed.collections) {
    throw new RestoreError('The file is not a store backup from this system, or is an older format');
  }
  if (parsed.host !== host) {
    throw new RestoreError(`This backup belongs to ${parsed.host ?? 'another store'} and can only be restored there`);
  }

  const report: RestoreReport = {
    dryRun,
    host,
    exportedAt: parsed.exportedAt instanceof Date ? parsed.exportedAt.toISOString() : undefined,
    collections: [],
    skipped: [],
    errors: [],
    restored: false,
  };

  // Validate and cast through the schema, so a document the app couldn't
  // have written never lands.
  const models = dumpableModels(connection);
  const plan: { model: Model<any>; docs: Record<string, unknown>[] }[] = [];
  for (const [name, docs] of Object.entries(parsed.collections)) {
    const model = models.get(name);
    if (!model || !Array.isArray(docs)) {
      report.skipped.push(name);
      continue;
    }
    const cast: Record<string, unknown>[] = [];
    for (const [i, raw] of docs.entries()) {
      try {
        const doc = new model(raw);
        await doc.validate();
        cast.push(doc.toObject({ virtuals: false, getters: false, depopulate: true }));
      } catch (error) {
        if (report.errors.length < MAX_ERRORS) report.errors.push(`${name}[${i}]: ${(error as Error).message}`);
        else if (report.errors.length === MAX_ERRORS) report.errors.push('…more errors not shown');
      }
    }
    plan.push({ model, docs: cast });
    report.collections.push({ name, documents: docs.length });
  }

  if (dryRun) return report;
  if (report.errors.length) throw new RestoreError('The backup has documents the current schemas reject', report);

  const secrets = SECRET_MODELS.map((name) => connection.model(name));
  // Indexes stay: documents are replaced, collections are not dropped.
  await withTransaction(connection, async (session) => {
    for (const { model, docs } of plan) {
      await model.collection.deleteMany({}, { session });
      if (docs.length) await model.collection.insertMany(docs, { session });
    }
    // Sessions from after the backup point at users that may no longer exist.
    for (const model of secrets) await model.collection.deleteMany({}, { session });
  });

  report.restored = true;
  return report;
}

/** A restore refused because of the file itself (as opposed to the database being unreachable). */
export class RestoreError extends Error {
  constructor(
    message: string,
    readonly report?: RestoreReport,
  ) {
    super(message);
  }
}
