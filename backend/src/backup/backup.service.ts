import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import mongoose, { Connection } from 'mongoose';
import { gunzipSync, gzipSync } from 'zlib';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { TenantRecord } from '../common/tenant/tenant-registry';
import {
  BackupInfo,
  BackupKind,
  backupId,
  backupsEnabled,
  deleteBackup,
  getBackup,
  listBackups,
  parseBackupId,
  putBackup,
} from './backup-storage';
import { dumpStore, registerTenantModels, RestoreError, RestoreReport, restoreStore } from './store-dump';

const DAY = 24 * 60 * 60_000;

export interface RestoreResult extends RestoreReport {
  /** The backup of the store's state just before the restore, to undo it. */
  safetyBackup?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  /** Hosts with a backup or restore running on this instance; one at a time per store. */
  private readonly busy = new Set<string>();

  constructor(private readonly tenants: TenantConnectionService) {}

  /** Days a backup is kept (BACKUP_RETENTION_DAYS, default 3). The newest that many are kept regardless of age. */
  retentionDays(): number {
    const days = Number(process.env.BACKUP_RETENTION_DAYS ?? 3);
    return days > 0 ? days : 3;
  }

  async list(host: string): Promise<BackupInfo[]> {
    this.assertEnabled();
    await this.store(host);
    return listBackups(host);
  }

  /** Dumps the store, compresses it, uploads it and prunes old backups. */
  async create(host: string, kind: BackupKind): Promise<BackupInfo> {
    this.assertEnabled();
    const record = await this.store(host);
    return this.exclusive(host, () => this.backup(record, kind));
  }

  async download(host: string, id: string): Promise<Buffer> {
    this.assertEnabled();
    await this.store(host);
    this.assertId(id);
    return this.fetch(host, id);
  }

  /**
   * Checks the backup against the current schemas and, with `dryRun: false`
   * and the host typed as `confirm`, replaces the store's data with it. A
   * backup of the current state is taken first; if that fails, nothing is
   * touched.
   */
  async restore(host: string, id: string, options: { dryRun: boolean; confirm?: string }): Promise<RestoreResult> {
    this.assertEnabled();
    const record = await this.store(host);
    this.assertId(id);
    if (!options.dryRun && options.confirm?.trim().toLowerCase() !== host) {
      throw new BadRequestException(`Type the store's host (${host}) to confirm the restore`);
    }

    const dump = gunzipSync(await this.fetch(host, id)).toString('utf-8');
    if (options.dryRun) {
      return this.withConnection(record, (connection) => this.run(() => restoreStore(connection, host, dump)));
    }

    return this.exclusive(host, async () => {
      const safety = await this.backup(record, 'pre-restore');
      const report = await this.withConnection(record, (connection) =>
        this.run(() => restoreStore(connection, host, dump, { dryRun: false })),
      );
      this.logger.log(`${host}: restored ${id} (state before it saved as ${safety.id})`);
      return { ...report, safetyBackup: safety.id };
    });
  }

  /**
   * The nightly run for one store. Claims `backup:<host>:<day>` in the
   * registry first, so it happens once a day across every API instance, and
   * gives the claim back on failure so a later run retries it.
   */
  async runDaily(host: string, day: string): Promise<'done' | 'skipped'> {
    const registry = this.tenants.getRegistry();
    const key = `backup:${host}:${day}`;
    if (!(await registry.claimJob(key))) return 'skipped';
    try {
      const record = await this.store(host);
      await this.exclusive(host, () => this.backup(record, 'daily'));
      return 'done';
    } catch (error) {
      await registry.releaseJob(key).catch(() => undefined);
      throw error;
    }
  }

  private async backup(record: TenantRecord, kind: BackupKind): Promise<BackupInfo> {
    const started = Date.now();
    const dump = await this.withConnection(record, (connection) => dumpStore(connection, record.host));
    const body = gzipSync(dump);
    const id = backupId(kind);
    await putBackup(record.host, id, body);
    this.logger.log(`${record.host}: ${kind} backup ${id} (${(body.length / 1024).toFixed(0)} KB, ${Date.now() - started} ms)`);

    await this.prune(record.host).catch((error) =>
      this.logger.warn(`${record.host}: could not prune old backups: ${(error as Error).message}`),
    );
    return { id, kind, createdAt: parseBackupId(id)!.createdAt.toISOString(), size: body.length };
  }

  /** Deletes backups older than the retention, always keeping the newest `retentionDays` of them. */
  private async prune(host: string): Promise<void> {
    const days = this.retentionDays();
    const cutoff = Date.now() - days * DAY;
    const backups = await listBackups(host);
    for (const backup of backups.slice(days)) {
      if (new Date(backup.createdAt).getTime() < cutoff) {
        await deleteBackup(host, backup.id);
        this.logger.log(`${host}: pruned backup ${backup.id}`);
      }
    }
  }

  private async fetch(host: string, id: string): Promise<Buffer> {
    try {
      return await getBackup(host, id);
    } catch (error: any) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`Backup ${id} not found`);
      }
      throw error;
    }
  }

  /** Turns a refused restore into a 409 carrying the report. */
  private async run(fn: () => Promise<RestoreReport>): Promise<RestoreReport> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof RestoreError) throw new ConflictException({ message: error.message, report: error.report });
      throw error;
    }
  }

  private async exclusive<T>(host: string, fn: () => Promise<T>): Promise<T> {
    if (this.busy.has(host)) throw new ConflictException(`A backup or restore of ${host} is already running`);
    this.busy.add(host);
    try {
      return await fn();
    } finally {
      this.busy.delete(host);
    }
  }

  /** The registered store (not an alias), disabled or not. */
  private async store(host: string): Promise<TenantRecord> {
    const record = (await this.tenants.getRegistry().list()).find((r) => r.host === host);
    if (!record) throw new NotFoundException(`${host} is not registered`);
    if (record.aliasOf) throw new BadRequestException(`${host} is an alias; back up ${record.aliasOf} instead`);
    return record;
  }

  private assertId(id: string): void {
    if (!parseBackupId(id)) throw new BadRequestException('Not a backup id');
  }

  private assertEnabled(): void {
    if (!backupsEnabled()) {
      throw new ServiceUnavailableException('Backups are not configured. Set R2_BACKUP_BUCKET and the R2 keys.');
    }
  }

  /** A throwaway connection, so a disabled store (no pooled connection) works too. */
  private async withConnection<T>(record: TenantRecord, fn: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await mongoose
      .createConnection(record.mongoUri, { serverSelectionTimeoutMS: 10_000 })
      .asPromise();
    try {
      registerTenantModels(connection);
      return await fn(connection);
    } finally {
      await connection.close();
    }
  }
}
