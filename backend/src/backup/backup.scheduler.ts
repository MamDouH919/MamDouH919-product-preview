import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { BackupService } from './backup.service';
import { backupsEnabled } from './backup-storage';

/** Boot catch-up waits this long, so a deploy settles before the databases are read. */
const CATCH_UP_DELAY_MS = 2 * 60_000;

/** The wall-clock date and time in `timeZone`. */
function wallClock(timeZone: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    secondsIntoDay: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

/** Milliseconds from `at` until the next midnight in `timeZone` (a few seconds past, to land inside the new day). */
export function msUntilMidnight(timeZone: string, at = new Date()): number {
  const { secondsIntoDay } = wallClock(timeZone, at);
  return (24 * 3600 - secondsIntoDay) * 1000 - at.getMilliseconds() + 5_000;
}

/**
 * Backs up every active store at midnight (BACKUP_TZ, default Africa/Cairo),
 * and once shortly after boot so a store whose midnight run was missed (API
 * down, deploy) still gets today's. Each store is claimed per day in the
 * registry, so several API instances never back the same store up twice.
 * Disabled stores and aliases are left out.
 *
 * Config (env): R2_BACKUP_BUCKET (required), BACKUP_ENABLED ("false" turns
 * the schedule off; manual backups still work), BACKUP_TZ, BACKUP_RETENTION_DAYS.
 */
@Injectable()
export class BackupScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BackupScheduler.name);
  private readonly timeZone = process.env.BACKUP_TZ || 'Africa/Cairo';
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly backups: BackupService,
    private readonly tenants: TenantConnectionService,
  ) {}

  onApplicationBootstrap() {
    if (!backupsEnabled() || process.env.BACKUP_ENABLED === 'false' || !process.env.PLATFORM_MONGO_URL) {
      this.logger.log('Scheduled backups are off (needs R2_BACKUP_BUCKET and PLATFORM_MONGO_URL, BACKUP_ENABLED not "false")');
      return;
    }
    this.schedule(CATCH_UP_DELAY_MS);
    this.logger.log(`Daily backups at 00:00 ${this.timeZone}, kept ${this.backups.retentionDays()} days`);
  }

  onModuleDestroy() {
    clearTimeout(this.timer);
  }

  private schedule(delay = msUntilMidnight(this.timeZone)) {
    // Recomputed after every run, so DST changes and timer drift never add up.
    this.timer = setTimeout(() => {
      void this.runAll().finally(() => this.schedule());
    }, delay);
    this.timer.unref();
  }

  async runAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const { day } = wallClock(this.timeZone, new Date());
    let done = 0;
    const failed: string[] = [];

    try {
      for (const host of this.tenants.getStoreHosts()) {
        try {
          if ((await this.backups.runDaily(host, day)) === 'done') done++;
        } catch (error) {
          failed.push(host);
          this.logger.error(`${host}: daily backup failed: ${(error as Error).message}`);
        }
      }
      if (done || failed.length) {
        this.logger.log(`Daily backups for ${day}: ${done} done${failed.length ? `, failed: ${failed.join(', ')}` : ''}`);
      }
    } finally {
      this.running = false;
    }
  }
}
