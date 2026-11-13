import mongoose, { Connection, Model, Schema } from 'mongoose';
import { decryptSecret, encryptSecret } from '../helpers/secret-box';
import type { TenantConfig } from '../helpers/dynamic-connection';
import { DEFAULT_PLAN, StorePlan } from './store-plan';
import { ErrorLogStore } from './error-log-store';
import { PriceChangeStore } from './price-change-store';

/** One store as the platform dashboard sees it. `mongoUri` is plain text here. */
export interface TenantRecord extends TenantConfig {
  host: string;
  /** A disabled store answers 404 everywhere, as if it weren't registered. */
  disabled: boolean;
  plan: StorePlan;
  createdAt?: Date;
  updatedAt?: Date;
}

interface StoredTenant {
  host: string;
  /** Encrypted with secret-box: connection strings carry database credentials. */
  mongoUri: string;
  frontendUrl: string;
  aliasOf?: string;
  disabled: boolean;
  /** Missing on stores registered before plans existed; read as DEFAULT_PLAN. */
  plan?: StorePlan;
  /** Missing on stores registered before languages were set here; read as the defaults. */
  languages?: string[];
  defaultLanguage?: string;
  /** Missing on stores registered before warehouses; read as DEFAULT_MAX_WAREHOUSES. */
  maxWarehouses?: number;
  /** The paid staff-accounts add-on; missing reads as off. */
  team?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoredTenantSchema = new Schema<StoredTenant>(
  {
    host: { type: String, required: true, unique: true },
    mongoUri: { type: String, required: true },
    frontendUrl: { type: String, required: true },
    aliasOf: { type: String },
    disabled: { type: Boolean, default: false },
    plan: { type: String, enum: Object.values(StorePlan), default: DEFAULT_PLAN },
    // No defaults: an unset value keeps following DEFAULT_LANGUAGES / DEFAULT_LANGUAGE.
    languages: { type: [String], default: undefined },
    defaultLanguage: { type: String },
    maxWarehouses: { type: Number, min: 1 },
    team: { type: Boolean },
  },
  { timestamps: true, collection: 'tenants' },
);

/**
 * The tenant map kept in its own database (PLATFORM_MONGO_URL), so stores can
 * be added and changed from the platform dashboard without a redeploy. It
 * holds no store data — only which host goes to which database.
 */
export class TenantRegistry {
  private constructor(
    readonly uri: string,
    private readonly connection: Connection,
    private readonly model: Model<StoredTenant>,
    readonly errors: ErrorLogStore,
    readonly priceChanges: PriceChangeStore,
  ) {}

  static async open(uri: string): Promise<TenantRegistry> {
    const connection = await mongoose.createConnection(uri).asPromise();
    const model = connection.model<StoredTenant>('PlatformTenant', StoredTenantSchema);
    await model.init();
    const errors = new ErrorLogStore(connection);
    await errors.init();
    const priceChanges = new PriceChangeStore(connection);
    await priceChanges.init();
    return new TenantRegistry(uri, connection, model, errors, priceChanges);
  }

  async list(): Promise<TenantRecord[]> {
    const docs = await this.model.find().sort({ host: 1 }).lean();
    return docs.map((doc) => ({
      host: doc.host,
      mongoUri: decryptSecret(doc.mongoUri),
      frontendUrl: doc.frontendUrl,
      ...(doc.aliasOf ? { aliasOf: doc.aliasOf } : {}),
      disabled: Boolean(doc.disabled),
      plan: doc.plan ?? DEFAULT_PLAN,
      ...(doc.languages?.length ? { languages: [...doc.languages] } : {}),
      ...(doc.defaultLanguage ? { defaultLanguage: doc.defaultLanguage } : {}),
      ...(doc.maxWarehouses ? { maxWarehouses: doc.maxWarehouses } : {}),
      ...(doc.team ? { team: true } : {}),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  async isEmpty(): Promise<boolean> {
    return (await this.model.estimatedDocumentCount()) === 0;
  }

  async create(record: Omit<TenantRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.model.create({ ...record, mongoUri: encryptSecret(record.mongoUri) });
  }

  /** Writes the whole record; `aliasOf` left out clears it. */
  async replace(record: Omit<TenantRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    const { aliasOf, ...rest } = record;
    const $set = { ...rest, mongoUri: encryptSecret(record.mongoUri), ...(aliasOf ? { aliasOf } : {}) };
    await this.model.updateOne({ host: record.host }, aliasOf ? { $set } : { $set, $unset: { aliasOf: 1 } });
  }

  async remove(host: string): Promise<void> {
    await this.model.deleteOne({ host });
  }

  /** Copies a TENANT_MAP / config.json map in — used once, into an empty registry. */
  async importMap(map: Record<string, TenantConfig>): Promise<void> {
    for (const [host, cfg] of Object.entries(map)) {
      await this.create({ host, ...cfg, plan: cfg.plan ?? DEFAULT_PLAN, disabled: false });
    }
  }

  /**
   * Claims a one-off job (e.g. "backup:shop.com:2026-11-12") for this
   * instance. True for exactly one caller across every API instance sharing
   * this registry; false when another already has it.
   */
  async claimJob(key: string): Promise<boolean> {
    try {
      await this.connection
        .collection<{ _id: string; claimedAt: Date }>('job_claims')
        .insertOne({ _id: key, claimedAt: new Date() });
      return true;
    } catch (error: any) {
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  /** Gives a claim back, so a job that failed can be retried. */
  async releaseJob(key: string): Promise<void> {
    await this.connection.collection<{ _id: string }>('job_claims').deleteOne({ _id: key });
  }

  close(): Promise<void> {
    return this.connection.close();
  }
}
