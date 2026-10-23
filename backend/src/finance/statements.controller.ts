import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { toCsv } from '../common/helpers/csv';
import { formatMinor } from '../common/money/money';
import { StatementsService } from './statements.service';
import { PeriodsService } from './periods.service';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';

class StatementQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  /** `csv` to download a spreadsheet instead of JSON. */
  @IsOptional()
  @Matches(/^(json|csv)$/)
  format?: string;

  @IsOptional()
  @Matches(/^(en|ar)$/)
  lang?: 'en' | 'ar';
}

class LockPeriodDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  through!: string;
}

class ReopenPeriodDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  through?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

type AdminRequest = Request & { userId?: string };
const money = (minor: number) => formatMinor(minor);
const named = (name: Record<string, string | undefined> | undefined, lang: 'en' | 'ar') => name?.[lang] ?? name?.en ?? name?.ar ?? '';

/** The financial statements, as JSON for the dashboard or CSV for a spreadsheet. */
@RequireModules(StoreModule.FINANCE)
@Controller('finance')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class StatementsController {
  constructor(
    private readonly statements: StatementsService,
    private readonly periods: PeriodsService,
  ) {}

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/profit-and-loss')
  async profitAndLoss(@Query() q: StatementQueryDto, @Res() res: Response) {
    const pl = await this.statements.profitAndLoss(q.from, q.to);
    const lang = q.lang ?? 'en';
    return this.send(res, q, 'profit-and-loss', pl, ['account', 'name', 'amount', 'previous'], () =>
      [...pl.revenue, ...pl.costOfSales, ...pl.expenses].map((l) => [l.code, named(l.name, lang), money(l.amountMinor), l.previousMinor === undefined ? '' : money(l.previousMinor)]),
    );
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/cash-flow')
  async cashFlow(@Query() q: StatementQueryDto, @Res() res: Response) {
    const flow = await this.statements.cashFlow(q.from, q.to);
    const lang = q.lang ?? 'en';
    return this.send(res, q, 'cash-flow', flow, ['source', 'amount'], () => flow.lines.map((l) => [l.name ? named(l.name, lang) : l.key, money(l.amountMinor)]));
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/receivables')
  async receivables(@Query() q: StatementQueryDto, @Res() res: Response) {
    const r = await this.statements.receivables();
    return this.send(res, q, 'receivables', r, ['order', 'customer', 'phone', 'delivered_at', 'total', 'collected', 'owed', 'days', 'bucket'], () =>
      r.rows.map((x) => [x.orderNumber, x.customer, x.phone, x.deliveredAt, money(x.totalMinor), money(x.collectedMinor), money(x.owedMinor), x.days, x.bucket]),
    );
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/payables')
  async payables(@Query() q: StatementQueryDto, @Res() res: Response) {
    const p = await this.statements.payables();
    return this.send(res, q, 'payables', p, ['purchase', 'supplier', 'invoice', 'date', 'due', 'total', 'owed', 'days', 'overdue_days', 'bucket'], () =>
      p.rows.map((x) => [x.purchaseNumber, x.supplier, x.supplierInvoiceNo, x.date, x.dueDate, money(x.totalMinor), money(x.owedMinor), x.days, x.overdueDays, x.bucket]),
    );
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/trial-balance')
  async trialBalance(@Query() q: StatementQueryDto, @Res() res: Response) {
    const tb = await this.statements.trialBalance(q.to);
    const lang = q.lang ?? 'en';
    return this.send(res, q, 'trial-balance', tb, ['account', 'name', 'debit', 'credit', 'balance'], () => [
      ...tb.accounts.map((a) => [a.code, named(a.name, lang), money(a.debitMinor), money(a.creditMinor), money(a.balanceMinor)]),
      ['', 'Total', money(tb.totalDebitMinor), money(tb.totalCreditMinor), ''],
    ]);
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('reports/sales-by-product')
  async salesByProduct(@Query() q: StatementQueryDto, @Res() res: Response) {
    const s = await this.statements.salesByProduct(q.from, q.to);
    const lang = q.lang ?? 'en';
    return this.send(res, q, 'sales-by-product', s, ['product', 'variant', 'units', 'net_sales', 'cost', 'margin', 'uncosted_units', 'refunded_units', 'refunded'], () =>
      s.rows.map((r) => [named(r.name, lang), r.variantLabel ?? '', r.units, money(r.netSalesMinor), money(r.costMinor), money(r.marginMinor), r.uncostedUnits, r.refundedUnits, money(r.refundedMinor)]),
    );
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('periods')
  getPeriods() {
    return this.periods.get();
  }

  /** The store's own super admin only — checked in the service. */
  @Permissions([{ resource: Resource.FINANCE, actions: [Action.EXECUTE] }])
  @Post('periods/lock')
  lock(@Body() dto: LockPeriodDto, @Req() req: AdminRequest) {
    return this.periods.lock(dto.through, req.userId);
  }

  @Permissions([{ resource: Resource.FINANCE, actions: [Action.EXECUTE] }])
  @Post('periods/reopen')
  reopen(@Body() dto: ReopenPeriodDto, @Req() req: AdminRequest) {
    return this.periods.reopen(dto.through, dto.reason, req.userId);
  }

  private send(res: Response, q: StatementQueryDto, name: string, json: unknown, header: string[], rows: () => unknown[][]) {
    if (q.format !== 'csv') return res.json(json);
    const range = [q.from, q.to].filter(Boolean).join('_to_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}${range ? `-${range}` : ''}.csv"`);
    return res.send(toCsv(header, rows()));
  }
}
