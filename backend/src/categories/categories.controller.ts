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
import { CategoriesService, categoryImageStorage } from './categories.service';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.CATEGORIES, actions: [Action.CREATE] }])
  @Post()
  @UseInterceptors(FileInterceptor('image', { storage: categoryImageStorage }))
  create(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const createCategoryDto = parseNestedBody(body) as CreateCategoryDto;
    return this.categoriesService.create(createCategoryDto, file);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('active')
  findActive() {
    return this.categoriesService.findActive();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.CATEGORIES, actions: [Action.UPDATE] }])
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', { storage: categoryImageStorage }))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updateCategoryDto = parseNestedBody(body) as UpdateCategoryDto;
    return this.categoriesService.update(id, updateCategoryDto, file);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.CATEGORIES, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
