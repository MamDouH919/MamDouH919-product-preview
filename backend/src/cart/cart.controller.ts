import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CartService } from './cart.service';
import { CartRemindersOptOutDto, SaveCartDto } from './dto/cart.dto';
import { CustomerAuthGuard } from '../guards/customer-auth.guard';
import { AuthThrottlerGuard } from '../guards/auth-throttler.guard';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

type CustomerRequest = Request & { customerId?: string };

/** The signed-in customer's saved basket. */
@RequireModules(StoreModule.ORDERS)
@Controller('customers/me/cart')
@UseGuards(CustomerAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: CustomerRequest) {
    return this.cartService.getCart(req.customerId!);
  }

  @Put()
  saveCart(@Body() dto: SaveCartDto, @Req() req: CustomerRequest) {
    return this.cartService.saveCart(req.customerId!, dto);
  }
}

/** Public: the "stop these emails" link in a cart reminder. The token is the authorisation. */
@RequireModules(StoreModule.ORDERS)
@Controller('cart-reminders')
export class CartRemindersController {
  constructor(private readonly cartService: CartService) {}

  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('opt-out')
  optOut(@Body() dto: CartRemindersOptOutDto, @Req() req: Request) {
    return this.cartService.optOut(dto.token, req.hostname);
  }
}
