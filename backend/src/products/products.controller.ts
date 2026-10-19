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
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ProductsService, productImageStorage } from './products.service';
import { parseNestedBody } from '../common/helpers/parse-nested-body';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.PRODUCTS, actions: [Action.CREATE] }])
  @Post()
  @UseInterceptors(AnyFilesInterceptor({ storage: productImageStorage }))
  create(
    @Body() body: any,
    @Req() req: Request & { userId?: string },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const createProductDto = parseNestedBody(body) as CreateProductDto;
    return this.productsService.create(createProductDto, files ?? [], req.userId);
  }

  @Get()
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('subCategoryId') subCategoryId?: string,
  ) {
    if (subCategoryId) return this.productsService.findBySubCategory(subCategoryId);
    if (categoryId) return this.productsService.findByCategory(categoryId);
    return this.productsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.productsService.findActive();
  }

  /** Public catalogue search — active products only, paged. */
  @Get('search')
  search(@Query() query: SearchProductsDto) {
    return this.productsService.search(query);
  }

  /** Public: active products by comma-separated ids, kept in the order given. */
  @Get('by-ids')
  findByIds(@Query('ids') ids?: string) {
    return this.productsService.findByIds((ids ?? '').split(',').map((id) => id.trim()));
  }

  @Get(':id/related')
  findRelated(@Param('id') id: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 8, 1), 24);
    return this.productsService.findRelated(id, n);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Post('slug/:slug/view')
  incrementViews(@Param('slug') slug: string) {
    return this.productsService.incrementViews(slug);
  }

  @Post('slug/:slug/whatsapp-click')
  incrementWhatsappClicks(@Param('slug') slug: string) {
    return this.productsService.incrementWhatsappClicks(slug);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.PRODUCTS, actions: [Action.UPDATE] }])
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor({ storage: productImageStorage }))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request & { userId?: string },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const updateProductDto = parseNestedBody(body) as UpdateProductDto;
    return this.productsService.update(id, updateProductDto, files ?? [], req.userId);
  }

  @UseGuards(AuthenticationGuard, AuthorizationGuard)
  @Permissions([{ resource: Resource.PRODUCTS, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
