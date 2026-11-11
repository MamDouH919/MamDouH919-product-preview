import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsEnum } from 'class-validator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/action.enum';
import { RequireModules } from '../decorators/store-module.decorator';
import { StoreModule } from '../common/tenant/store-plan';
import { toCsv } from '../common/helpers/csv';
import { formatMinor } from '../common/money/money';
import { AccountType } from './accounts';
import { ChartService } from './chart.service';
import { LedgerService } from './ledger.service';
import {
  AccountStatementQueryDto,
  CreateLedgerAccountDto,
  CreateManualJournalDto,
  JournalQueryDto,
  ReverseJournalDto,
  UpdateLedgerAccountDto,
} from './dto/accounting.dto';

type AdminRequest = Request & { userId?: string };

class NextCodeQueryDto {
  @IsEnum(AccountType)
  type!: AccountType;
}

/**
 * The chart of accounts, the journal and each account's statement. Reading
 * needs the finance reports permission; changing the chart or posting and
 * reversing entries by hand needs the books permission (closing periods).
 */
@RequireModules(StoreModule.FINANCE)
@Controller('finance')
@UseGuards(AuthenticationGuard, AuthorizationGuard)
export class AccountingController {
  constructor(
    private readonly chart: ChartService,
    private readonly ledger: LedgerService,
  ) {}

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('accounts')
  accounts() {
    return this.chart.list();
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('accounts/next-code')
  nextCode(@Query() q: NextCodeQueryDto) {
    return this.chart.nextCode(q.type).then((code) => ({ code }));
  }

  @Permissions([{ resource: Resource.FINANCE, actions: [Action.EXECUTE] }])
  @Post('accounts')
  createAccount(@Body() dto: CreateLedgerAccountDto, @Req() req: AdminRequest) {
    return this.chart.create(dto, req.userId);
  }

  @Permissions([{ resource: Resource.FINANCE, actions: [Action.EXECUTE] }])
  @Patch('accounts/:code')
  updateAccount(@Param('code') code: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.chart.update(code, dto);
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('accounts/:code/statement')
  async statement(@Param('code') code: string, @Query() q: AccountStatementQueryDto, @Res() res: Response) {
    const s = await this.ledger.accountStatement(code, q);
    if (q.format !== 'csv') return res.json(s);
    const lang = q.lang ?? 'en';
    const name = (n: { en: string; ar: string }) => n[lang] || n.en;
    const header = ['date', 'entry', 'source', 'memo', 'against', 'debit', 'credit', 'balance'];
    const rows: unknown[][] = [
      ['', '', '', lang === 'ar' ? 'رصيد افتتاحي' : 'Opening balance', '', '', '', formatMinor(s.openingMinor)],
      ...s.rows.map((r) => [
        r.date.toISOString().slice(0, 10),
        r.entryNumber,
        `${r.source.type}${r.source.number ? ` #${r.source.number}` : ''}`,
        [r.memo?.[lang], r.note].filter(Boolean).join(' · '),
        r.counterparts.map((c) => `${c.code} ${name(c.name)}`).join(', '),
        formatMinor(r.debitMinor),
        formatMinor(r.creditMinor),
        formatMinor(r.balanceMinor),
      ]),
      ['', '', '', lang === 'ar' ? 'الإجمالي / رصيد ختامي' : 'Totals / closing balance', '', formatMinor(s.debitMinor), formatMinor(s.creditMinor), formatMinor(s.closingMinor)],
    ];
    const range = [q.from, q.to].filter(Boolean).join('_to_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${code}${range ? `-${range}` : ''}.csv"`);
    return res.send(toCsv(header, rows));
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('journal')
  journal(@Query() q: JournalQueryDto) {
    return this.ledger.list(q);
  }

  @Permissions([{ resource: Resource.FINANCE_REPORTS, actions: [Action.READ] }])
  @Get('journal/:id')
  entry(@Param('id') id: string) {
    return this.ledger.get(id);
  }

  @Permissions([{ resource: Resource.FINANCE, actions: [Action.EXECUTE] }])
  @Post('journal')
  createEntry(@Body() dto: CreateManualJournalDto, @Req() req: AdminRequest) {
    return this.ledger.createManual(dto, req.userId);
  }

  @Permissions([{ resource: Resource.FINANCE, actions: [Action.EXECUTE] }])
  @Post('journal/:id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseJournalDto, @Req() req: AdminRequest) {
    return this.ledger.reverseManual(id, dto, req.userId);
  }
}
