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
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubCategoriesService, subCategoryImageStorage } from './sub-categories.service';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

@Controller('sub-categories')
export class SubCategoriesController {
  constructor(private readonly subCategoriesService: SubCategoriesService) {}

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SUB_CATEGORIES, actions: [Action.CREATE] }])
  @Post()
  @UseInterceptors(FileInterceptor('image', { storage: subCategoryImageStorage }))
  create(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const createSubCategoryDto = parseNestedBody(body) as CreateSubCategoryDto;
    return this.subCategoriesService.create(createSubCategoryDto, file);
  }

  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    if (categoryId) {
      return this.subCategoriesService.findByCategory(categoryId);
    }
    return this.subCategoriesService.findAll();
  }

  @Get('active')
  findActive() {
    return this.subCategoriesService.findActive();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.subCategoriesService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subCategoriesService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SUB_CATEGORIES, actions: [Action.UPDATE] }])
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage: subCategoryImageStorage }))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updateSubCategoryDto = parseNestedBody(body) as UpdateSubCategoryDto;
    return this.subCategoriesService.update(id, updateSubCategoryDto, file);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.SUB_CATEGORIES, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subCategoriesService.remove(id);
  }
}
