import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, mongo } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/schemas/user.schema';
import { RefreshToken } from '../auth/schemas/refresh-schema.schema';
import { ResetToken } from '../auth/schemas/reset-token.schema';
import { Otp } from '../auth/schemas/otp.schema';
import { CustomerRefreshToken, CustomerResetToken } from '../customer-auth/schemas/customer-token.schema';
import { Order } from '../orders/schemas/order.schema';
import { ReturnRequest } from '../returns/schemas/return-request.schema';
import { StockMovement } from '../inventory/schemas/stock-movement.schema';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';

const { EJSON } = mongo.BSON;

/** Written into every export; an import refuses any other shape. */
const EXPORT_FORMAT = 'store-export/1';

/**
 * Live credentials: never exported (a backup file must not hand out sessions
 * or reset links) and never imported.
 */
const SECRET_MODELS = [
  RefreshToken.name,
  ResetToken.name,
  Otp.name,
  CustomerRefreshToken.name,
  CustomerResetToken.name,
];

/**
 * A store with any of these already has a financial history. An import would
 * replace it, so one is only accepted into a store where all are empty.
 */
const FINANCIAL_MODELS = [Order.name, ReturnRequest.name, StockMovement.name];

/** Most validation errors one report lists. */
const MAX_ERRORS = 20;

export interface ImportOptions {
  password?: string;
  /** Must be the store's own host, typed by hand. */
  confirm?: string;
  /** Anything but an explicit `false` only checks the file. */
  dryRun?: boolean;
}

export interface ImportReport {
  dryRun: boolean;
  host: string;
  exportedAt?: string;
  collections: { name: string; documents: number }[];
  /** Collections in the file this store has no model for, or that hold secrets. */
  skipped: string[];
  errors: string[];
  /** Why the import can't go ahead even if the file is valid. */
  blockers: string[];
  imported: boolean;
}

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(TENANT_CONNECTION) private connection: Connection,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async assertSuper(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user?.isSuper) throw new ForbiddenException('Super admin only');
    return user;
  }

  /**
   * This store's data as Extended JSON, which keeps ObjectIds, dates and
   * longs as their real types. Not a backup — backups are taken at the
   * database layer — but a faithful copy of one store for inspection or a
   * move to a fresh store.
   */
  async exportAll(userId: string, host: string): Promise<string> {
    await this.assertSuper(userId);

    const collections: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const [name, model] of this.exportableModels()) {
      const docs = await model.collection.find({}).toArray();
      collections[name] = docs;
      counts[name] = docs.length;
    }

    return EJSON.stringify(
      { format: EXPORT_FORMAT, host, exportedAt: new Date(), counts, collections },
      { relaxed: false },
    );
  }

  /**
   * Restores an export of this same store into it. Checks the file first and,
   * unless `dryRun` is explicitly false, stops there with the report. It
   * refuses a file from another store, a store that already has orders,
   * returns or stock history, and a file that would lock the importer out.
   * The write itself is one transaction: all collections land, or none do.
   */
  async importAll(
    userId: string,
    host: string,
    file: Buffer | undefined,
    options: ImportOptions,
  ): Promise<ImportReport> {
    const user = await this.assertSuper(userId);
    // 403, not 401: the session is fine, and the dashboard signs out on any 401.
    if (!options.password || !(await bcrypt.compare(options.password, user.password))) {
      throw new ForbiddenException('Password is incorrect');
    }
    if (options.confirm?.trim().toLowerCase() !== host.toLowerCase()) {
      throw new BadRequestException(`Type this store's address (${host}) to confirm the import`);
    }
    if (!file?.length) throw new BadRequestException('Choose an export file to import');

    let parsed: { format?: string; host?: string; exportedAt?: Date; collections?: Record<string, unknown> };
    try {
      parsed = EJSON.parse(file.toString('utf-8'), { relaxed: false });
    } catch {
      throw new BadRequestException('The file is not a valid export');
    }
    if (parsed?.format !== EXPORT_FORMAT || typeof parsed.collections !== 'object' || !parsed.collections) {
      throw new BadRequestException('The file is not a store export from this system, or is an older format');
    }
    if (parsed.host !== host) {
      throw new ForbiddenException(
        `This file was exported from ${parsed.host ?? 'another store'} and can only be restored there`,
      );
    }

    const report: ImportReport = {
      dryRun: options.dryRun !== false,
      host,
      exportedAt: parsed.exportedAt instanceof Date ? parsed.exportedAt.toISOString() : undefined,
      collections: [],
      skipped: [],
      errors: [],
      blockers: [],
      imported: false,
    };

    // Validate and cast every document through its schema, so a document the
    // app couldn't have written never lands.
    const models = this.exportableModels();
    const plan: { model: Model<any>; docs: Record<string, unknown>[] }[] = [];
    for (const [name, docs] of Object.entries(parsed.collections)) {
      const model = models.get(name);
      if (!model) {
        report.skipped.push(name);
        continue;
      }
      if (!Array.isArray(docs) || docs.length === 0) continue;

      const cast: Record<string, unknown>[] = [];
      for (const [i, raw] of docs.entries()) {
        const doc = new model(raw);
        try {
          await doc.validate();
          cast.push(doc.toObject({ virtuals: false, getters: false, depopulate: true }));
        } catch (error) {
          if (report.errors.length < MAX_ERRORS) {
            report.errors.push(`${name}[${i}]: ${(error as Error).message}`);
          }
        }
      }
      plan.push({ model, docs: cast });
      report.collections.push({ name, documents: docs.length });
    }

    for (const name of FINANCIAL_MODELS) {
      if (await this.connection.model(name).exists({})) {
        report.blockers.push(
          `This store already has ${this.connection.model(name).collection.collectionName}; ` +
            'an import is only accepted into a store with no orders, returns or stock history',
        );
      }
    }

    // Replacing users must not remove the person doing it.
    const users = plan.find((p) => p.model.modelName === User.name);
    if (users && !users.docs.some((u) => u.email === user.email && u.isSuper === true)) {
      report.blockers.push(`The file has no super admin with your email (${user.email}); importing it would lock you out`);
    }

    if (report.dryRun) return report;
    if (report.errors.length || report.blockers.length) {
      throw new ConflictException({ message: 'The import was refused', report });
    }

    // Indexes stay: documents are replaced, collections are not dropped.
    await withTransaction(this.connection, async (session) => {
      for (const { model, docs } of plan) {
        await model.collection.deleteMany({}, { session });
        if (docs.length) await model.collection.insertMany(docs, { session });
      }
    });

    report.imported = true;
    return report;
  }

  /** Collection name → model for everything a store export may hold. */
  private exportableModels(): Map<string, Model<any>> {
    const models = new Map<string, Model<any>>();
    for (const name of this.connection.modelNames()) {
      if (SECRET_MODELS.includes(name)) continue;
      const model = this.connection.model(name);
      models.set(model.collection.collectionName, model);
    }
    return models;
  }
}
