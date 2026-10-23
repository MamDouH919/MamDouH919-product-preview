import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ReturnsService } from './returns.service';
import { CreateReturnDto, QueryReturnsDto, ReturnDecisionDto } from './dto/return.dto';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

type CustomerRequest = Request & { customerId?: string };
type AdminRequest = Request & { userId?: string };

/** The customer's side — only ever their own orders. */
@RequireModules(StoreModule.ORDERS)
@Controller('returns/me')
@UseGuards(CustomerAuthGuard)
export class CustomerReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get('order/:orderId')
  forOrder(@Param('orderId') orderId: string, @Req() req: CustomerRequest) {
    return this.returnsService.customerView(req.customerId!, orderId);
  }

  @Post()
  create(@Body() dto: CreateReturnDto, @Req() req: CustomerRequest) {
    return this.returnsService.createByCustomer(req.customerId!, dto, req.hostname);
  }
}

/** The store's side. Returns are part of orders, so they share its permission. */
@RequireModules(StoreModule.ORDERS)
@Controller('returns')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get()
  findAll(@Query() query: QueryReturnsDto) {
    return this.returnsService.findAll(query);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get('order/:orderId')
  forOrder(@Param('orderId') orderId: string) {
    return this.returnsService.findForOrder(orderId);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.UPDATE] }])
  @Post()
  create(@Body() dto: CreateReturnDto, @Req() req: AdminRequest) {
    return this.returnsService.createByStore(dto, req.userId, req.hostname);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.UPDATE] }])
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ReturnDecisionDto, @Req() req: AdminRequest) {
    return this.returnsService.approve(id, dto.note, req.userId, req.hostname);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.UPDATE] }])
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ReturnDecisionDto, @Req() req: AdminRequest) {
    return this.returnsService.reject(id, dto.note, req.userId, req.hostname);
  }

  // Refunding a return is `POST /finance/refunds` with its `returnId`: refunds
  // have their own permissions, approval and record.
}
