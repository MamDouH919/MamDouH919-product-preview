import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SettingsService, settingImageStorage } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { parseNestedBody } from '../common/helpers/parse-nested-body';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  @UseGuards(AuthenticationGuard)
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
  ) {
    const dto: UpdateSettingDto = parseNestedBody(body);
    return this.settingsService.update(dto, files ?? {});
  }
}
