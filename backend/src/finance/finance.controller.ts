import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { PaymentsService } from './payments.service';
import { FinanceReportsService } from './finance-reports.service';
import { ReconciliationService } from './reconciliation.service';
import { FinanceSummaryQueryDto, RecordCollectionDto, VoidCollectionDto, WriteOffDto } from './dto/finance.dto';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

type AdminRequest = Request & { userId?: string };

/** The store's books. Every route acts on the request's own store only. */
@RequireModules(StoreModule.FINANCE)
@Controller('finance')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class FinanceController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly reports: FinanceReportsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Permissions([{ resource: Resource.ORDERS, actions: [Action.READ] }])
  @Get('orders/:id')
  orderFinance(@Param('id') id: string) {
    return this.payments.orderFinance(id);
  }

  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.CREATE] }])
  @Post('orders/:id/collections')
  recordCollection(@Param('id') id: string, @Body() dto: RecordCollectionDto, @Req() req: AdminRequest) {
    return this.payments.recordCollection(id, dto, req.userId);
  }

  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.APPROVE] }])
  @Post('orders/:id/write-off')
  writeOff(@Param('id') id: string, @Body() dto: WriteOffDto, @Req() req: AdminRequest) {
    return this.payments.writeOff(id, dto.amount, dto.reason, req.userId);
  }

  @Permissions([{ resource: Resource.PAYMENTS, actions: [Action.APPROVE] }])
  @Post('payments/:id/void')
  voidCollection(@Param('id') id: string, @Body() dto: VoidCollectionDto, @Req() req: AdminRequest) {
    return this.payments.voidCollection(id, dto.reason, req.userId);
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/summary')
  summary(@Query() query: FinanceSummaryQueryDto) {
    return this.reports.summary(query.from, query.to);
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reconciliation')
  reconcile() {
    return this.reconciliation.run();
  }
}
