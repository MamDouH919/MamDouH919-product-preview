import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SettingsService, settingImageStorage } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import type { Request } from 'express';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenants: TenantConnectionService,
  ) {}

  /** Public. Carries the store's plan, which the storefront and dashboard shape themselves around. */
  @Get()
  async get(@Req() req: Request) {
    const setting = await this.settingsService.get();
    const host: string = req['tenant'] ?? req.hostname;
    return {
      ...setting.toJSON(),
      plan: this.tenants.getPlan(host),
      modules: this.tenants.getModules(host),
    };
  }

  // A role decides who may change the store's settings, as for mail settings —
  // being signed in to the dashboard is not enough.
  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.UPDATE] }])
  @Patch()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'favicon', maxCount: 1 },
      ],
      { storage: settingImageStorage },
    ),
  )
  update(
    @Body() body: any,
    @UploadedFiles() files: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
    @Req() req: { userId: string },
  ) {
    const dto: UpdateSettingDto = parseNestedBody(body);
    return this.settingsService.update(dto, files ?? {}, req.userId);
  }
}
