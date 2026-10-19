import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { MailService } from '../mail/mail.service';
import { MailSettingsService } from '../mail/mail-settings.service';
import { TestMailDto, UpdateMailSettingDto } from '../mail/dto/update-mail-setting.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

/** The store's outgoing mail server. Dashboard-only — never public. */
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller('settings/mail')
export class MailSettingsController {
  constructor(
    private readonly mailSettings: MailSettingsService,
    private readonly mail: MailService,
  ) {}

  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.READ] }])
  @Get()
  get() {
    return this.mailSettings.getPublic();
  }

  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.UPDATE] }])
  @Patch()
  update(@Body() dto: UpdateMailSettingDto) {
    return this.mailSettings.update(dto);
  }

  /** Tries the given (possibly unsaved) values and sends a test email. */
  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.UPDATE] }])
  // Each test opens a real SMTP connection — cap it.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('test')
  test(@Body() dto: TestMailDto) {
    return this.mail.sendTest(dto);
  }
}
