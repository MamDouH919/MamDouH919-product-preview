import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Setting, SettingSchema } from './schemas/setting.schema';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { MailSettingsController } from './mail-settings.controller';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [SettingsController, MailSettingsController],
  providers: [
    SettingsService,
    tenantModelProvider(Setting.name, SettingSchema),
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
