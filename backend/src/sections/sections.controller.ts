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
  UploadedFiles,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { SectionsService, sectionImageStorage } from './sections.service';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SECTIONS, actions: [Action.CREATE] }])
  @Post()
  @UseInterceptors(AnyFilesInterceptor({ storage: sectionImageStorage }))
  create(
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const createSectionDto = parseNestedBody(body) as CreateSectionDto;
    return this.sectionsService.create(createSectionDto, files ?? []);
  }

  @Get()
  findAll() {
    return this.sectionsService.findAll();
  }

  @Get('name/:sectionName')
  findByName(@Param('sectionName') sectionName: string) {
    return this.sectionsService.findByName(sectionName);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sectionsService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SECTIONS, actions: [Action.UPDATE] }])
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor({ storage: sectionImageStorage }))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const updateSectionDto = parseNestedBody(body) as UpdateSectionDto;
    return this.sectionsService.update(id, updateSectionDto, files ?? []);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SECTIONS, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sectionsService.remove(id);
  }
}
