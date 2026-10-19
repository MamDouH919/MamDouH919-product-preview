import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// `import type` — used bare in decorated signatures (see customer-auth.controller).
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import {
  CancelOrderDto,
  CreateGuestOrderDto,
  CreateOrderDto,
  GuestOrderAccountDto,
  ExportOrdersDto,
  GuestOrderTokenDto,
  TrackOrderDto,
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
import { AuthThrottlerGuard } from '../guards/auth-throttler.guard';

type CustomerRequest = Request & { customerId?: string };

/** Pricing a basket. Public — the cart page uses it before anyone signs in. */
@Controller('orders/quote')
export class OrderQuoteController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  quote(@Body() dto: QuoteOrderDto) {
    return this.ordersService.quote(dto.items, dto.couponCode, dto.subZoneId);
  }
}

/**
 * Public order lookup by number plus email or phone. Rate limited hard, since
 * order numbers are sequential and this is the one place they can be probed.
 */
@Controller('orders/track')
export class OrderTrackingController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @Post()
  track(@Body() dto: TrackOrderDto) {
    return this.ordersService.track(Number(dto.orderNumber), dto.contact);
  }
}

/**
 * Checkout without an account. Public, so each route is rate limited, and a
 * guest order is only ever readable with the secret token it was issued.
 */
@Controller('orders/guest')
export class GuestOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(AuthThrottlerGuard)
  @Post()
  create(@Body() dto: CreateGuestOrderDto, @Req() req: Request) {
    return this.ordersService.createGuest(dto, req.hostname);
  }

  // POST rather than GET so the token stays out of access logs.
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':id')
  findOne(@Param('id') id: string, @Body() dto: GuestOrderTokenDto) {
    return this.ordersService.findGuestOrder(id, dto.token);
  }

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @Post(':id/account')
  claimAccount(
    @Param('id') id: string,
    @Body() dto: GuestOrderAccountDto,
    @Req() req: Request,
  ) {
    return this.ordersService.claimGuestAccount(id, dto.token, dto.password, req.hostname);
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

  /** Declared before `:id`, which would otherwise read "export" as an order id. */
  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Query() query: ExportOrdersDto) {
    return this.ordersService.exportCsv(query);
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
