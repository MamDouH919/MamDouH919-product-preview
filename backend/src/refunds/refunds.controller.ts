import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RefundsService } from './refunds.service';
import {
  CreateRefundDto,
  QueryRefundsDto,
  RefundBasisDto,
  RefundDecisionDto,
  ReverseRefundDto,
  UpdateRefundRulesDto,
} from './dto/refund.dto';

type AdminRequest = Request & { userId?: string };

/**
 * Refunds have their own permissions, apart from order updates: who may ask
 * for one, who may approve it, and who may pay it out are separate actions.
 */
@Controller('finance')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.READ] }])
  @Get('refund-rules')
  rules() {
    return this.refunds.getRules();
  }

  /** The store's own super admin only — checked in the service. */
  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.READ] }])
  @Patch('refund-rules')
  updateRules(@Body() dto: UpdateRefundRulesDto, @Req() req: AdminRequest) {
    return this.refunds.updateRules(dto, req.userId);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.REQUEST] }])
  @Post('refunds/preview')
  preview(@Body() dto: RefundBasisDto) {
    return this.refunds.preview(dto);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.REQUEST] }])
  @Post('refunds')
  request(@Body() dto: CreateRefundDto, @Req() req: AdminRequest) {
    return this.refunds.request(dto, req.userId);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.READ] }])
  @Get('refunds')
  findAll(@Query() query: QueryRefundsDto) {
    return this.refunds.findAll(query);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.READ] }])
  @Get('refunds/:id')
  findOne(@Param('id') id: string) {
    return this.refunds.findOne(id);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.APPROVE] }])
  @Patch('refunds/:id/approve')
  approve(@Param('id') id: string, @Body() dto: RefundDecisionDto, @Req() req: AdminRequest) {
    return this.refunds.approve(id, req.userId, dto.note);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.APPROVE] }])
  @Patch('refunds/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RefundDecisionDto, @Req() req: AdminRequest) {
    return this.refunds.reject(id, req.userId, dto.note);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.EXECUTE] }])
  @Post('refunds/:id/execute')
  execute(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.refunds.execute(id, req.userId, req.hostname);
  }

  @Permissions([{ resource: Resource.REFUNDS, actions: [Action.APPROVE] }])
  @Post('refunds/:id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseRefundDto, @Req() req: AdminRequest) {
    return this.refunds.reverse(id, dto.reason, req.userId);
  }
}
