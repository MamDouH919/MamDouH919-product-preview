import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto,
  QueryProductReviewsDto,
  QueryReviewsDto,
  ReplyReviewDto,
  UpdateReviewDto,
  UpdateReviewStatusDto,
} from './dto/review.dto';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

type CustomerRequest = Request & { customerId?: string };

/** Public: approved reviews only. */
@Controller('reviews/product')
export class ProductReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':productId')
  findForProduct(@Param('productId') productId: string, @Query() query: QueryProductReviewsDto) {
    return this.reviewsService.findForProduct(productId, query);
  }
}

/** The customer's own reviews. Every route acts on the customer in the token. */
@RequireModules(StoreModule.ORDERS)
@Controller('reviews/me')
@UseGuards(CustomerAuthGuard)
export class CustomerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('eligibility/:productId')
  eligibility(@Param('productId') productId: string, @Req() req: CustomerRequest) {
    return this.reviewsService.eligibility(req.customerId!, productId);
  }

  @Post()
  create(@Body() dto: CreateReviewDto, @Req() req: CustomerRequest) {
    return this.reviewsService.create(req.customerId!, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto, @Req() req: CustomerRequest) {
    return this.reviewsService.updateMine(req.customerId!, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: CustomerRequest) {
    return this.reviewsService.removeMine(req.customerId!, id);
  }
}

/** Moderation. */
@Controller('reviews')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Permissions([{ resource: Resource.REVIEWS, actions: [Action.READ] }])
  @Get()
  findAll(@Query() query: QueryReviewsDto) {
    return this.reviewsService.findAll(query);
  }

  @Permissions([{ resource: Resource.REVIEWS, actions: [Action.UPDATE] }])
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateReviewStatusDto) {
    return this.reviewsService.setStatus(id, dto.status);
  }

  @Permissions([{ resource: Resource.REVIEWS, actions: [Action.UPDATE] }])
  @Patch(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplyReviewDto) {
    return this.reviewsService.reply(id, dto.reply);
  }

  @Permissions([{ resource: Resource.REVIEWS, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
