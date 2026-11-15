import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { GatewaySettingsService } from './gateway-settings.service';
import { OnlinePaymentsService } from './online-payments.service';
import { TestGatewayDto, UpdateGatewaySettingsDto } from './dto/gateway-settings.dto';
import { apiOrigin } from './api-origin';
import { GatewayPayoutsService } from './gateway-payouts.service';
import { ResolveGatewayRefundDto } from './dto/gateway-resolve.dto';
import { RecordPayoutDto, ReversePayoutDto } from './dto/gateway-payout.dto';

type AdminRequest = Request & { userId?: string };

/** Public: what the checkout page may offer. */
@Controller('online-payments')
export class OnlinePaymentsPublicController {
  constructor(private readonly payments: OnlinePaymentsService) {}

  @Get('available')
  async available() {
    return { online: await this.payments.isAvailable() };
  }
}

/**
 * The gateway calls this. No login — the provider's signature is the proof —
 * so it never answers anything but a verified notice. Declared after the
 * store-module check, so a store without the add-on answers 404.
 */
@RequireModules(StoreModule.ONLINE_PAYMENTS)
@Controller('online-payments/webhook')
export class OnlinePaymentsWebhookController {
  constructor(private readonly payments: OnlinePaymentsService) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Query() query: Record<string, string | undefined>,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    await this.payments.handleWebhook(provider, { body, rawBody: req.rawBody, query, headers: req.headers });
    return { received: true };
  }
}

/** The store's gateway keys. Dashboard only; the platform must have switched the add-on on. */
@RequireModules(StoreModule.ONLINE_PAYMENTS)
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller('settings/payments')
export class GatewaySettingsController {
  constructor(
    private readonly settings: GatewaySettingsService,
    private readonly payments: OnlinePaymentsService,
  ) {}

  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.READ] }])
  @Get()
  get(@Req() req: Request) {
    return this.settings.getPublic().then((s) => ({ ...s, webhookBase: `${apiOrigin(req)}/online-payments/webhook` }));
  }

  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.UPDATE] }])
  @Patch()
  update(@Body() dto: UpdateGatewaySettingsDto) {
    return this.settings.update(dto);
  }

  /** Opens a throwaway checkout with the given (possibly unsaved) keys. */
  @Permissions([{ resource: Resource.SETTINGS, actions: [Action.UPDATE] }])
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('test')
  test(@Body() dto: TestGatewayDto, @Req() req: Request) {
    const origin = apiOrigin(req);
    return this.payments.testKeys(dto.provider, dto.credentials, { apiOrigin: origin, returnUrl: origin });
  }
}

/** Staff giving an online payment back (the automatic try failed, or they are retrying). */
@RequireModules(StoreModule.ONLINE_PAYMENTS)
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller('online-payments/payments')
export class GatewayRefundsController {
  constructor(private readonly payments: OnlinePaymentsService) {}

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.UPDATE] }])
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':id/refund')
  async refund(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Payment not found');
    await this.payments.refundPayment(id);
    return { refunded: true };
  }

  /** Settles a refund stuck "in progress" once someone has looked at the gateway. */
  @Permissions([{ resource: Resource.ORDERS, actions: [Action.UPDATE] }])
  @HttpCode(200)
  @Post(':id/refund-resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveGatewayRefundDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Payment not found');
    await this.payments.resolveStuckPayment(id, dto.outcome, dto.note);
    return { resolved: true };
  }
}

/** What the gateway paid out to the bank, and the fees it kept. Needs the books. */
@RequireModules(StoreModule.ONLINE_PAYMENTS, StoreModule.FINANCE)
@UseGuards(AuthenticationGuard, AuthorizationGuard)
@Controller('online-payments/payouts')
export class GatewayPayoutsController {
  constructor(private readonly payouts: GatewayPayoutsService) {}

  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.READ] }])
  @Get()
  list() {
    return this.payouts.list();
  }

  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.CREATE] }])
  @Post()
  record(@Body() dto: RecordPayoutDto, @Req() req: AdminRequest) {
    return this.payouts.record(dto, req.userId);
  }

  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.APPROVE] }])
  @HttpCode(200)
  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReversePayoutDto, @Req() req: AdminRequest) {
    return this.payouts.reverse(id, dto.reason, req.userId);
  }
}
