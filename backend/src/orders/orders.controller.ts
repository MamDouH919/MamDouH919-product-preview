import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// `import type` — used bare in decorated signatures (see customer-auth.controller).
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import {
  CancelOrderDto,
  CreateOrderDto,
  QueryOrdersDto,
  QuoteOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';

type CustomerRequest = Request & { customerId?: string };

/** Pricing a basket. Public — the cart page uses it before anyone signs in. */
@Controller('orders/quote')
export class OrderQuoteController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  quote(@Body() dto: QuoteOrderDto) {
    return this.ordersService.quote(dto.items, dto.couponCode);
  }
}

/**
 * The customer's side. Every route acts on the customer in the token, so one
 * customer can never read or cancel another's order.
 */
@Controller('orders/me')
@UseGuards(CustomerAuthGuard)
export class CustomerOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: CustomerRequest) {
    return this.ordersService.create(req.customerId!, dto, req.hostname);
  }

  @Get()
  findAll(@Query() query: QueryOrdersDto, @Req() req: CustomerRequest) {
    return this.ordersService.findAllMine(req.customerId!, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: CustomerRequest) {
    return this.ordersService.findMine(req.customerId!, id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: CustomerRequest,
  ) {
    return this.ordersService.cancelByCustomer(req.customerId!, id, dto.reason, req.hostname);
  }
}

/** The store's side. */
@Controller('orders')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get()
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.UPDATE] }])
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: Request & { userId?: string },
  ) {
    return this.ordersService.updateStatus(id, dto.status, dto.note, req.userId, req.hostname);
  }
}
