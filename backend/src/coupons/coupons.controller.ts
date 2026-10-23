import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, QueryCouponsDto, UpdateCouponDto } from './dto/coupon.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

/**
 * Admin management only. Shoppers apply a code through `POST /orders/quote`,
 * so there is no public endpoint that confirms whether a code exists.
 */
@RequireModules(StoreModule.ORDERS)
@Controller('coupons')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Permissions([{ resource: Resource.COUPONS, actions: [Action.CREATE] }])
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Permissions([{ resource: Resource.COUPONS, actions: [Action.READ] }])
  @Get()
  findAll(@Query() query: QueryCouponsDto) {
    return this.couponsService.findAll(query);
  }

  @Permissions([{ resource: Resource.COUPONS, actions: [Action.READ] }])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Permissions([{ resource: Resource.COUPONS, actions: [Action.UPDATE] }])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Permissions([{ resource: Resource.COUPONS, actions: [Action.DELETE] }])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
