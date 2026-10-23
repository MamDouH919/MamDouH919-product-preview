import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import mongoose, { Connection } from 'mongoose';
import {
  databaseKey,
  liveTenantMap,
  TenantConnectionService,
} from '../common/helpers/dynamic-connection';
import { TenantRecord } from '../common/tenant/tenant-registry';
import { DEFAULT_PLAN, StorePlan } from '../common/tenant/store-plan';
import { seedTenant } from '../common/tenant/seed-tenant';
import { supportsTransactions } from '../common/tenant/with-transaction';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { CreateTenantDto, SeedTenantDto, UpdateTenantDto } from './dto/tenant.dto';

/** What the dashboard is shown: the connection string never leaves the server with its credentials. */
export interface TenantView {
  host: string;
  frontendUrl: string;
  aliasOf: string | null;
  disabled: boolean;
  /** An alias's own plan is ignored: it serves its primary host's. */
  plan: StorePlan;
  /** The connection string with any user:password replaced by `***`. */
  database: string;
  /** Whether this API instance holds an open connection to it right now. */
  connected: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantCheck {
  ok: boolean;
  latencyMs?: number;
  transactions?: boolean;
  collections?: number;
  users?: number;
  error?: string;
}

export function redactMongoUri(uri: string): string {
  return uri.replace(/^(mongodb(?:\+srv)?:\/\/)[^@/]*@/i, '$1***@');
}

const stripSlash = (url: string) => url.replace(/\/+$/, '');

@Injectable()
export class PlatformTenantsService {
  constructor(private tenants: TenantConnectionService) {}

  async list(): Promise<TenantView[]> {
    const records = await this.tenants.getRegistry().list();
    return records.map((record) => this.view(record));
  }

  async create(dto: CreateTenantDto): Promise<TenantView> {
    const registry = this.tenants.getRegistry();
    const records = await registry.list();
    if (records.some((r) => r.host === dto.host)) {
      throw new ConflictException(`${dto.host} is already registered`);
    }

    const record: TenantRecord = {
      host: dto.host,
      mongoUri: dto.mongoUri,
      frontendUrl: stripSlash(dto.frontendUrl),
      ...(dto.aliasOf ? { aliasOf: dto.aliasOf } : {}),
      disabled: false,
      plan: dto.plan ?? DEFAULT_PLAN,
    };
    this.assertValid([...records, record], registry.uri);

    await registry.create(record);
    await this.tenants.reload();
    return this.view(record);
  }

  async update(host: string, dto: UpdateTenantDto): Promise<TenantView> {
    const registry = this.tenants.getRegistry();
    const records = await registry.list();
    const current = this.find(records, host);

    const next: TenantRecord = {
      ...current,
      mongoUri: dto.mongoUri ?? current.mongoUri,
      frontendUrl: dto.frontendUrl ? stripSlash(dto.frontendUrl) : current.frontendUrl,
      disabled: dto.disabled ?? current.disabled,
      plan: dto.plan ?? current.plan,
    };
    if (dto.aliasOf !== undefined) {
      if (dto.aliasOf) next.aliasOf = dto.aliasOf;
      else delete next.aliasOf;
    }
    this.assertValid(
      records.map((r) => (r.host === host ? next : r)),
      registry.uri,
    );

    await registry.replace(next);
    await this.tenants.reload();
    return this.view(next);
  }

  /** Unregisters the host. Its database is left untouched. */
  async remove(host: string): Promise<void> {
    const registry = this.tenants.getRegistry();
    const records = await registry.list();
    this.find(records, host);

    const aliases = records.filter((r) => r.aliasOf === host).map((r) => r.host);
    if (aliases.length) {
      throw new ConflictException(`Remove its aliases first: ${aliases.join(', ')}`);
    }

    await registry.remove(host);
    await this.tenants.reload();
  }

  /** Connects to the store's database on a throwaway connection and reports what it finds. */
  async check(host: string): Promise<TenantCheck> {
    const record = this.find(await this.tenants.getRegistry().list(), host);
    try {
      return await this.withConnection(record, async (connection) => {
        const started = Date.now();
        await connection.db!.command({ ping: 1 });
        const latencyMs = Date.now() - started;
        const [transactions, collections, users] = await Promise.all([
          supportsTransactions(connection),
          connection.db!.listCollections({}, { nameOnly: true }).toArray(),
          connection.model(User.name, UserSchema).countDocuments(),
        ]);
        return { ok: true, latencyMs, transactions, collections: collections.length, users };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message.split(record.mongoUri).join(redactMongoUri(record.mongoUri)) };
    }
  }

  /** Creates the store's roles and admin users; existing users are left alone. */
  async seed(host: string, dto: SeedTenantDto): Promise<{ log: string[] }> {
    const record = this.find(await this.tenants.getRegistry().list(), host);
    if (dto.superAdmin && dto.superAdmin.email === dto.admin.email) {
      throw new BadRequestException('Admin and super admin need different emails');
    }
    const log = await this.withConnection(record, (connection) =>
      seedTenant(connection, { admin: dto.admin, superAdmin: dto.superAdmin }),
    );
    return { log };
  }

  private find(records: TenantRecord[], host: string): TenantRecord {
    const record = records.find((r) => r.host === host);
    if (!record) throw new NotFoundException(`${host} is not registered`);
    return record;
  }

  /** The same rules the API boots with, plus: no store may live in the registry's own database. */
  private assertValid(records: TenantRecord[], registryUri: string): void {
    try {
      liveTenantMap(records);
      const registryDb = databaseKey(registryUri);
      const clash = records.find((r) => databaseKey(r.mongoUri) === registryDb);
      if (clash) {
        throw new Error(`${clash.host} points at the platform registry's database; give the store its own database`);
      }
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }
  }

  private async withConnection<T>(record: TenantRecord, fn: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await mongoose
      .createConnection(record.mongoUri, { serverSelectionTimeoutMS: 5_000 })
      .asPromise();
    try {
      return await fn(connection);
    } finally {
      await connection.close();
    }
  }

  private view(record: TenantRecord): TenantView {
    return {
      host: record.host,
      frontendUrl: record.frontendUrl,
      aliasOf: record.aliasOf ?? null,
      disabled: record.disabled,
      plan: record.plan,
      database: redactMongoUri(record.mongoUri),
      connected: this.tenants.isConnected(record.host),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
