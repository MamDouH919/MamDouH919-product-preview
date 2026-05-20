import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BannersService, bannerImageStorage } from './banners.service';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.BANNERS, actions: [Action.CREATE] }])
  @Post()
  @UseInterceptors(FileInterceptor('image', { storage: bannerImageStorage }))
  create(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const createBannerDto = parseNestedBody(body) as CreateBannerDto;
    return this.bannersService.create(createBannerDto, file);
  }

  @Get()
  findAll() {
    return this.bannersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.BANNERS, actions: [Action.UPDATE] }])
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage: bannerImageStorage }))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updateBannerDto = parseNestedBody(body) as UpdateBannerDto;
    return this.bannersService.update(id, updateBannerDto, file);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.BANNERS, actions: [Action.UPDATE] }])
  @Patch(':id/weight')
  updateWeight(
    @Param('id') id: string,
    @Body('weight') weight: number,
  ) {
    return this.bannersService.updateWeight(id, weight);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.BANNERS, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
