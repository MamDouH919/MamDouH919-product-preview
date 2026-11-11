import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LedgerAccount } from './schemas/ledger-account.schema';
import { JournalEntry } from './schemas/journal-entry.schema';
import { ACCOUNT_CODES, AccountType, CashFlowActivity, CODE_PREFIXES } from './accounts';
import { accountBalance } from './account-balance';
import { JournalService } from './journal.service';
import { CreateLedgerAccountDto, UpdateLedgerAccountDto } from './dto/accounting.dto';
import { formatMinor } from '../common/money/money';

/**
 * The chart of accounts: the built-in accounts every store has, plus the ones
 * a store adds (a bank loan, equipment, another revenue stream). Built-in
 * accounts are read-only; added ones keep their code and type for life and
 * are deactivated rather than deleted, so their history keeps reporting.
 */
@Injectable()
export class ChartService {
  constructor(
    @InjectModel(LedgerAccount.name) private accountModel: Model<LedgerAccount>,
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    private readonly journal: JournalService,
  ) {}

  /** Every account with its all-time debits, credits and balance. */
  async list() {
    const [chart, totals] = await Promise.all([this.journal.chart(), this.totals()]);
    return chart.map((a) => {
      const t = totals.get(a.code);
      const debit = t?.debit ?? 0;
      const credit = t?.credit ?? 0;
      return { ...a, debitMinor: debit, creditMinor: credit, entries: t?.entries ?? 0, ...accountBalance(a.type, debit, credit) };
    });
  }

  async get(code: string) {
    const account = (await this.journal.chartByCode()).get(code);
    if (!account) throw new NotFoundException(`No account ${code} in the chart`);
    return account;
  }

  /** The next free code for a type, for the dashboard to suggest. */
  async nextCode(type: AccountType): Promise<string> {
    const taken = new Set((await this.journal.chart()).map((a) => a.code));
    const prefix = CODE_PREFIXES[type][0];
    for (let n = Number(`${prefix}000`); n <= Number(`${prefix}999`); n += 10) {
      if (!taken.has(String(n))) return String(n);
    }
    for (let n = Number(`${prefix}0000`); n <= Number(`${prefix}9999`); n++) {
      if (!taken.has(String(n))) return String(n);
    }
    throw new ConflictException('No free code left for this type');
  }

  async create(dto: CreateLedgerAccountDto, userId?: string) {
    const code = dto.code.trim();
    if (ACCOUNT_CODES.includes(code as never)) throw new ConflictException(`${code} is a built-in account`);
    if (!CODE_PREFIXES[dto.type].includes(code[0])) {
      throw new BadRequestException(`Codes for this type start with ${CODE_PREFIXES[dto.type].join(' or ')}`);
    }
    if (await this.accountModel.exists({ code })) throw new ConflictException(`Account ${code} already exists`);
    const account = await this.accountModel.create({
      code,
      name: { en: dto.name.en.trim(), ar: dto.name.ar.trim() },
      type: dto.type,
      cashFlowActivity: dto.cashFlowActivity ?? this.defaultActivity(dto.type),
      description: dto.description?.trim() || undefined,
      createdBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
    });
    return this.get(account.code);
  }

  /** Renames, re-describes or (de)activates an added account. Never its code or type. */
  async update(code: string, dto: UpdateLedgerAccountDto) {
    if (ACCOUNT_CODES.includes(code as never)) throw new ForbiddenException('Built-in accounts cannot be changed');
    const account = await this.accountModel.findOne({ code }).exec();
    if (!account) throw new NotFoundException(`No account ${code} in the chart`);
    if (dto.isActive === false && account.isActive) {
      const t = (await this.totals([code])).get(code);
      const balance = (t?.debit ?? 0) - (t?.credit ?? 0);
      if (balance !== 0) throw new ConflictException(`It still has a balance of ${formatMinor(Math.abs(balance))}; clear it with a journal entry first`);
    }
    const set: Record<string, unknown> = {};
    if (dto.name) set.name = { en: dto.name.en.trim(), ar: dto.name.ar.trim() };
    if (dto.cashFlowActivity) set.cashFlowActivity = dto.cashFlowActivity;
    if (dto.description !== undefined) set.description = dto.description.trim() || undefined;
    if (dto.isActive !== undefined) set.isActive = dto.isActive;
    await this.accountModel.updateOne({ _id: account._id }, { $set: set }).exec();
    return this.get(code);
  }

  /** Investing for assets and financing for liabilities and equity are the usual homes of accounts a store adds. */
  private defaultActivity(type: AccountType): CashFlowActivity {
    if (type === AccountType.ASSET) return CashFlowActivity.INVESTING;
    if (type === AccountType.LIABILITY || type === AccountType.EQUITY) return CashFlowActivity.FINANCING;
    return CashFlowActivity.OPERATING;
  }

  private async totals(codes?: string[]) {
    const rows = await this.entryModel
      .aggregate<{ _id: string; debit: number; credit: number; entries: number }>([
        ...(codes ? [{ $match: { 'lines.account': { $in: codes } } }] : []),
        { $unwind: '$lines' },
        ...(codes ? [{ $match: { 'lines.account': { $in: codes } } }] : []),
        { $group: { _id: '$lines.account', debit: { $sum: '$lines.debitMinor' }, credit: { $sum: '$lines.creditMinor' }, entries: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((r) => [r._id, r]));
  }
}
