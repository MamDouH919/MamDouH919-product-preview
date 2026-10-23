import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { CouriersService } from './couriers.service';
import { CreateCourierDto, SettleCourierDto, UpdateCourierDto } from './dto/courier.dto';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

@RequireModules(StoreModule.ORDERS, StoreModule.FINANCE)
@Controller('finance')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Permissions([{ resource: Resource.SETTLEMENTS, actions: [Action.READ] }])
  @Get('couriers')
  list() {
    return this.couriers.list();
  }

  @Permissions([{ resource: Resource.SETTLEMENTS, actions: [Action.READ] }])
  @Get('couriers/:id')
  detail(@Param('id') id: string) {
    return this.couriers.detail(id);
  }

  @Permissions([{ resource: Resource.SETTLEMENTS, actions: [Action.CREATE] }])
  @Post('couriers')
  create(@Body() dto: CreateCourierDto) {
    return this.couriers.create(dto);
  }

  @Permissions([{ resource: Resource.SETTLEMENTS, actions: [Action.UPDATE] }])
  @Patch('couriers/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCourierDto) {
    return this.couriers.update(id, dto);
  }

  /** The courier hands over the cash they hold. */
  @Permissions([{ resource: Resource.SETTLEMENTS, actions: [Action.EXECUTE] }])
  @Post('settlements')
  settle(@Body() dto: SettleCourierDto, @Req() req: Request & { userId?: string }) {
    return this.couriers.settle(dto, req.userId);
  }
}
