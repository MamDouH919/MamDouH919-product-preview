import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupScheduler } from './backup.scheduler';

/** Nightly store backups to the private R2 bucket; served to the platform dashboard by PlatformModule. */
@Module({
  providers: [BackupService, BackupScheduler],
  exports: [BackupService],
})
export class BackupModule {}
