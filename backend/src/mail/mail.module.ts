import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailSettingsService } from './mail-settings.service';
import { MailSetting, MailSettingSchema } from './schemas/mail-setting.schema';
import { Setting, SettingSchema } from '../settings/schemas/setting.schema';
import { tenantModelProvider } from '../common/tenant/tenant-model.provider';

@Module({
  providers: [
    MailService,
    MailSettingsService,
    tenantModelProvider(MailSetting.name, MailSettingSchema),
    tenantModelProvider(Setting.name, SettingSchema),
  ],
  exports: [MailService, MailSettingsService],
})
export class MailModule {}
