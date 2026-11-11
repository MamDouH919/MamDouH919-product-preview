import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { MoneyError, parseMoney } from '../common/money/money';
import { dayKey, zonedDayRange } from '../common/helpers/time-zone';
import { JournalEntry } from './schemas/journal-entry.schema';
import { MoneyAccount } from '../money-accounts/schemas/money-account.schema';
import { ACCOUNT, ChartAccount } from './accounts';
import { JournalService, PostingLine } from './journal.service';
import { FinanceReportsService } from './finance-reports.service';
import { AccountStatementQueryDto, CreateManualJournalDto, JournalQueryDto, ReverseJournalDto } from './dto/accounting.dto';
import { LocalText, memoText } from './journal-memo';

/** Entries typed in by staff, as opposed to those business events post. */
export const MANUAL_SOURCE = 'manual';
const POSTED = 'posted';
const REVERSED = 'reversed';
/** More lines than this in one statement and the range should be narrowed. */
const STATEMENT_MAX_LINES = 5000;
const HOUR_MS = 60 * 60 * 1000;

type LeanEntry = Pick<JournalEntry, 'entryNumber' | 'date' | 'source' | 'lines' | 'memo' | 'memoKey' | 'memoParams' | 'reversalOf' | 'postedAt' | 'createdBy'> & {
  _id: Types.ObjectId;
};

/**
 * Reading the books — the journal, and each account's statement — and the
 * one way staff write to them directly: a manual journal entry. A manual
 * entry is posted like any business event (balanced, in a transaction,
 * refused in a closed period) and, like them, never edited: a mistake is
 * cancelled by reversing it.
 */
@Injectable()
export class LedgerService {
  constructor(
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(MoneyAccount.name) private moneyAccountModel: Model<MoneyAccount>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
    private readonly reports: FinanceReportsService,
  ) {}

  /** Posts a manual entry: at least two lines, each a debit or a credit, totals equal. */
  async createManual(dto: CreateManualJournalDto, userId?: string) {
    const { timeZone } = await this.reports.storeClock();
    const date = this.dayDate(dto.date, timeZone);

    const lines = dto.lines.map((l, i) => {
      const debitMinor = this.amount(l.debit, `line ${i + 1} debit`);
      const creditMinor = this.amount(l.credit, `line ${i + 1} credit`);
      if ((debitMinor > 0) === (creditMinor > 0)) throw new BadRequestException(`Line ${i + 1}: enter a debit or a credit, not both or neither`);
      return { account: l.account.trim(), debitMinor, creditMinor, moneyAccountId: l.moneyAccountId, note: l.note?.trim() || undefined };
    });
    const debit = lines.reduce((t, l) => t + l.debitMinor, 0);
    const credit = lines.reduce((t, l) => t + l.creditMinor, 0);
    if (debit !== credit) throw new BadRequestException(`The entry does not balance: debits ${debit / 100} ≠ credits ${credit / 100}`);

    return withTransaction(this.connection, async (session) => {
      const chart = await this.journal.chartByCode(session);
      for (const [i, l] of lines.entries()) {
        const account = chart.get(l.account);
        if (!account) throw new BadRequestException(`Line ${i + 1}: no account ${l.account} in the chart`);
        if (!account.isActive) throw new BadRequestException(`Line ${i + 1}: account ${l.account} is inactive`);
        if (!account.allowsManual) {
          throw new BadRequestException(`Line ${i + 1}: ${l.account} ${account.name.en} is kept by its own documents (orders, stock, purchases, refunds) and can't take a manual entry`);
        }
        if (l.moneyAccountId && l.account !== ACCOUNT.CASH) throw new BadRequestException(`Line ${i + 1}: only cash lines take a money account`);
      }
      const postingLines: PostingLine[] = [];
      for (const l of lines) {
        postingLines.push({
          account: l.account,
          debitMinor: l.debitMinor,
          creditMinor: l.creditMinor,
          note: l.note,
          moneyAccount: l.account === ACCOUNT.CASH ? await this.journal.moneyAccount(l.moneyAccountId, session) : undefined,
        });
      }
      const entry = await this.journal.post(
        {
          date,
          source: { type: MANUAL_SOURCE, id: new Types.ObjectId(), event: POSTED },
          lines: postingLines,
          memo: [dto.memo.trim(), dto.reference?.trim() ? `Ref: ${dto.reference.trim()}` : ''].filter(Boolean).join(' · '),
          createdBy: userId,
        },
        session,
      );
      return entry!;
    });
  }

  /**
   * Cancels a manual entry with its mirror image. Entries that business
   * events posted are reversed by undoing the event (cancelling the order,
   * voiding the payment), never from here.
   */
  async reverseManual(id: string, dto: ReverseJournalDto, userId?: string) {
    const original = await this.entryModel.findById(this.oid(id)).exec();
    if (!original) throw new NotFoundException('Journal entry not found');
    if (original.source.type !== MANUAL_SOURCE) throw new BadRequestException('Only manual entries are reversed here; undo the document that posted this one instead');
    if (original.source.event !== POSTED) throw new BadRequestException('This entry is itself a reversal');

    const { timeZone } = await this.reports.storeClock();
    const date = dto.date ? this.dayDate(dto.date, timeZone) : new Date();
    return withTransaction(this.connection, async (session) => {
      if (await this.journal.findBySource(MANUAL_SOURCE, original.source.id, REVERSED, session)) {
        throw new ConflictException(`Entry #${original.entryNumber} is already reversed`);
      }
      return this.journal.reverse(original, REVERSED, date, session, userId, dto.reason.trim());
    });
  }

  /** The journal, newest first, with each line's account named. */
  async list(q: JournalQueryDto) {
    const { timeZone } = await this.reports.storeClock();
    const filter: Record<string, unknown> = {};
    const { start, end } = zonedDayRange(q.from, q.to, timeZone);
    if (start || end) filter.date = { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) };
    if (q.account) filter['lines.account'] = q.account;
    if (q.source) filter['source.type'] = q.source;
    const search = q.search?.trim();
    if (search) {
      const n = Number(search.replace(/^#/, ''));
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [...(Number.isSafeInteger(n) ? [{ entryNumber: n }, { 'source.number': n }] : []), { memo: { $regex: escaped, $options: 'i' } }];
    }
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const [rows, total, chart, reversed] = await Promise.all([
      this.entryModel
        .find(filter)
        .sort({ date: -1, entryNumber: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name')
        .lean<LeanEntry[]>()
        .exec(),
      this.entryModel.countDocuments(filter).exec(),
      this.journal.chartByCode(),
      this.entryModel.distinct('source.id', { 'source.type': MANUAL_SOURCE, 'source.event': REVERSED }).exec(),
    ]);
    const reversedIds = new Set(reversed.map(String));
    const moneyNames = await this.moneyAccountNames();
    return {
      page,
      limit,
      total,
      timeZone,
      rows: rows.map((e) => this.present(e, chart, moneyNames, reversedIds)),
    };
  }

  async get(id: string) {
    const entry = await this.entryModel.findById(this.oid(id)).populate('createdBy', 'name').lean<LeanEntry>().exec();
    if (!entry) throw new NotFoundException('Journal entry not found');
    const [chart, moneyNames, reversal] = await Promise.all([
      this.journal.chartByCode(),
      this.moneyAccountNames(),
      entry.source.type === MANUAL_SOURCE && entry.source.event === POSTED
        ? this.journal.findBySource(MANUAL_SOURCE, entry.source.id, REVERSED)
        : Promise.resolve(null),
    ]);
    return {
      ...this.present(entry, chart, moneyNames, new Set(reversal ? [String(entry.source.id)] : [])),
      reversedBy: reversal ? { _id: reversal._id, entryNumber: reversal.entryNumber } : undefined,
    };
  }

  /**
   * An account's statement for days `from`..`to`: the balance brought
   * forward, every line posted to it with the running balance after it, and
   * the balance carried forward. Balances are signed for the account's
   * nature — positive is normal (a debit for assets and expenses, a credit
   * for liabilities, equity and revenue), negative is the unusual side.
   */
  async accountStatement(code: string, q: AccountStatementQueryDto) {
    const chart = await this.journal.chartByCode();
    const account = chart.get(code);
    if (!account) throw new NotFoundException(`No account ${code} in the chart`);
    if (q.moneyAccount && code !== ACCOUNT.CASH) throw new BadRequestException('Only the cash account splits by money account');
    const { timeZone } = await this.reports.storeClock();
    const { start, end } = zonedDayRange(q.from, q.to, timeZone);
    const sign = account.normalSide === 'debit' ? 1 : -1;

    const lineMatch: Record<string, unknown> = { 'lines.account': code };
    if (q.moneyAccount) lineMatch['lines.moneyAccount'] = new Types.ObjectId(q.moneyAccount);

    const [opening] = start
      ? await this.entryModel
          .aggregate<{ debit: number; credit: number }>([
            { $match: { date: { $lt: start }, 'lines.account': code } },
            { $unwind: '$lines' },
            { $match: lineMatch },
            { $group: { _id: null, debit: { $sum: '$lines.debitMinor' }, credit: { $sum: '$lines.creditMinor' } } },
          ])
          .exec()
      : [];
    const openingMinor = sign * ((opening?.debit ?? 0) - (opening?.credit ?? 0)) || 0;

    const date: Record<string, Date> = {};
    if (start) date.$gte = start;
    if (end) date.$lt = end;
    const entries = await this.entryModel
      .find({ ...(start || end ? { date } : {}), 'lines.account': code })
      .sort({ date: 1, entryNumber: 1 })
      .limit(STATEMENT_MAX_LINES + 1)
      .lean<LeanEntry[]>()
      .exec();
    const truncated = entries.length > STATEMENT_MAX_LINES;
    const moneyNames = await this.moneyAccountNames();

    let running = openingMinor;
    let debitTotal = 0;
    let creditTotal = 0;
    const rows: {
      entryId: Types.ObjectId;
      entryNumber: number;
      date: Date;
      source: LeanEntry['source'];
      memo?: LocalText;
      note?: string;
      moneyAccount?: string;
      counterparts: { code: string; name: ChartAccount['name'] }[];
      debitMinor: number;
      creditMinor: number;
      balanceMinor: number;
    }[] = [];
    for (const e of entries.slice(0, STATEMENT_MAX_LINES)) {
      const counterparts = [...new Set(e.lines.filter((l) => l.account !== code).map((l) => l.account))].map((c) => ({
        code: c,
        name: chart.get(c)?.name ?? { en: c, ar: c },
      }));
      for (const l of e.lines) {
        if (l.account !== code) continue;
        if (q.moneyAccount && String(l.moneyAccount) !== q.moneyAccount) continue;
        running += sign * (l.debitMinor - l.creditMinor) || 0;
        debitTotal += l.debitMinor;
        creditTotal += l.creditMinor;
        rows.push({
          entryId: e._id,
          entryNumber: e.entryNumber,
          date: e.date,
          source: e.source,
          memo: memoText(e),
          note: l.note,
          moneyAccount: l.moneyAccount ? moneyNames.get(String(l.moneyAccount)) : undefined,
          counterparts,
          debitMinor: l.debitMinor,
          creditMinor: l.creditMinor,
          balanceMinor: running,
        });
      }
    }
    return {
      account,
      from: q.from,
      to: q.to,
      timeZone,
      openingMinor,
      debitMinor: debitTotal,
      creditMinor: creditTotal,
      closingMinor: running,
      rows,
      truncated,
    };
  }

  private present(e: LeanEntry, chart: Map<string, ChartAccount>, moneyNames: Map<string, string>, reversedIds: Set<string>) {
    const createdBy = e.createdBy as unknown as { _id: Types.ObjectId; name?: string } | undefined;
    return {
      _id: e._id,
      entryNumber: e.entryNumber,
      date: e.date,
      postedAt: e.postedAt,
      source: e.source,
      memo: memoText(e),
      isManual: e.source.type === MANUAL_SOURCE,
      isReversal: !!e.reversalOf,
      reversalOf: e.reversalOf,
      isReversed: e.source.event === POSTED && reversedIds.has(String(e.source.id)),
      createdBy: createdBy?.name ? { _id: createdBy._id, name: createdBy.name } : undefined,
      totalMinor: e.lines.reduce((t, l) => t + l.debitMinor, 0),
      lines: e.lines.map((l) => ({
        account: l.account,
        name: chart.get(l.account)?.name ?? { en: l.account, ar: l.account },
        type: chart.get(l.account)?.type,
        debitMinor: l.debitMinor,
        creditMinor: l.creditMinor,
        note: l.note,
        order: l.order,
        moneyAccount: l.moneyAccount ? { _id: l.moneyAccount, name: moneyNames.get(String(l.moneyAccount)) } : undefined,
      })),
    };
  }

  private async moneyAccountNames() {
    const accounts = await this.moneyAccountModel.find().select('name').lean().exec();
    return new Map(accounts.map((a) => [String(a._id), a.name]));
  }

  /** Midday of `day` in the store's zone: safely inside that day whatever the offset, and never in the future. */
  private dayDate(day: string, timeZone: string): Date {
    const today = dayKey(new Date(), timeZone);
    if (day > today) throw new BadRequestException('A journal entry cannot be dated in the future');
    const { start } = zonedDayRange(day, undefined, timeZone);
    const midday = new Date(start!.getTime() + 12 * HOUR_MS);
    return day === today ? new Date(Math.min(midday.getTime(), Date.now())) : midday;
  }

  private amount(text: string | undefined, what: string): number {
    if (text === undefined || text === '') return 0;
    try {
      return parseMoney(text);
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(`${what}: ${error.message}`);
      throw error;
    }
  }

  private oid(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Journal entry not found');
    return new Types.ObjectId(id);
  }
}
