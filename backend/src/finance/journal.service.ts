import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { JournalEntry } from './schemas/journal-entry.schema';
import { Counter } from '../orders/schemas/counter.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { ACCOUNT, ACCOUNT_CODES, isCreditNormal } from './accounts';
import { MoneyAccount, MoneyAccountType } from '../money-accounts/schemas/money-account.schema';

const JOURNAL_COUNTER = 'journal';

export interface PostingLine {
  account: string;
  debitMinor?: number;
  creditMinor?: number;
  order?: Types.ObjectId;
  customer?: Types.ObjectId;
  /** Cash lines: the cash box, bank or wallet. The store's default when left out. */
  moneyAccount?: Types.ObjectId;
}

export interface Posting {
  date: Date;
  source: { type: string; id: Types.ObjectId; number?: number; event: string };
  lines: PostingLine[];
  memo?: string;
  createdBy?: string;
  reversalOf?: Types.ObjectId;
}

/**
 * The only writer of the books. Every posting is checked to balance and
 * runs inside the caller's transaction, so the entry lands exactly when the
 * business event does — or neither does.
 */
@Injectable()
export class JournalService {
  constructor(
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    @InjectModel(MoneyAccount.name) private moneyAccountModel: Model<MoneyAccount>,
  ) {}

  /**
   * Writes one entry. Zero lines are dropped; what remains must be at least
   * two lines that balance to the piastre. Returns null when nothing is left
   * to post (a free order has no money to book).
   */
  async post(posting: Posting, session: ClientSession): Promise<JournalEntry | null> {
    const lines = posting.lines
      .map((l) => ({ ...l, debitMinor: l.debitMinor ?? 0, creditMinor: l.creditMinor ?? 0 }))
      .filter((l) => l.debitMinor !== 0 || l.creditMinor !== 0);
    if (!lines.length) return null;
    this.assertBalanced(lines);

    // Every cash line says where the money is; nobody picking means the main cash box.
    if (lines.some((l) => l.account === ACCOUNT.CASH && !l.moneyAccount)) {
      const fallback = await this.defaultMoneyAccount(session);
      for (const l of lines) if (l.account === ACCOUNT.CASH && !l.moneyAccount) l.moneyAccount = fallback;
    }

    const settings = await this.settingModel.findOne().select('finance').session(session).lean().exec();
    const locked = settings?.finance?.lockedThrough;
    if (locked && posting.date <= locked) {
      throw new ConflictException(
        `The books are closed through ${settings?.finance?.lockedThroughDay ?? locked.toISOString().slice(0, 10)}; this can't be dated on or before then`,
      );
    }

    const counter = await this.counterModel
      .findOneAndUpdate({ name: JOURNAL_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
      .exec();

    const [entry] = await this.entryModel.create(
      [
        {
          entryNumber: counter!.seq,
          date: posting.date,
          source: posting.source,
          lines,
          memo: posting.memo,
          createdBy: posting.createdBy ? new Types.ObjectId(posting.createdBy) : undefined,
          reversalOf: posting.reversalOf,
        },
      ],
      { session },
    );
    return entry;
  }

  /**
   * Cancels an earlier entry with its mirror image, dated `date` — never by
   * editing it. The original stays where it was, in its own period.
   */
  async reverse(
    original: JournalEntry,
    event: string,
    date: Date,
    session: ClientSession,
    createdBy?: string,
  ): Promise<JournalEntry | null> {
    return this.post(
      {
        date,
        source: { ...original.source, event },
        lines: original.lines.map((l) => ({
          account: l.account,
          debitMinor: l.creditMinor,
          creditMinor: l.debitMinor,
          order: l.order,
          customer: l.customer,
          moneyAccount: l.moneyAccount,
        })),
        memo: `Reverses entry #${original.entryNumber}`,
        createdBy,
        reversalOf: original._id as Types.ObjectId,
      },
      session,
    );
  }

  /**
   * The store's main cash box, created the first time money moves. Two
   * transactions creating it at once both write the one default slot, so
   * one retries and finds the other's.
   */
  async defaultMoneyAccount(session: ClientSession): Promise<Types.ObjectId> {
    const found = await this.moneyAccountModel.findOne({ isDefault: true }).select('_id').session(session).lean().exec();
    if (found) return found._id as Types.ObjectId;
    const [created] = await this.moneyAccountModel.create([{ name: 'Cash', type: MoneyAccountType.CASH, isDefault: true }], { session });
    return created._id as Types.ObjectId;
  }

  /** A money account to post to: the one asked for (active, of this store) or the default. */
  async moneyAccount(id: string | undefined, session: ClientSession): Promise<Types.ObjectId> {
    if (!id) return this.defaultMoneyAccount(session);
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Unknown money account');
    const found = await this.moneyAccountModel.findOne({ _id: id, isActive: true }).select('_id').session(session).lean().exec();
    if (!found) throw new BadRequestException('That money account is not found or inactive');
    return found._id as Types.ObjectId;
  }

  /** The entry an event posted, if it did. */
  findBySource(type: string, id: Types.ObjectId, event: string, session?: ClientSession) {
    return this.entryModel
      .findOne({ 'source.type': type, 'source.id': id, 'source.event': event })
      .session(session ?? null)
      .exec();
  }

  /**
   * When this store's books start. Set the first time anything asks, inside
   * that transaction, and never moved afterwards — so a store that never ran
   * the backfill starts its books at its first booked event.
   */
  async goLiveAt(session: ClientSession): Promise<Date> {
    const current = await this.settingModel.findOne().select('finance').session(session).lean().exec();
    if (current?.finance?.goLiveAt) return current.finance.goLiveAt;

    // Two transactions starting the books at once both write this document,
    // so one aborts and retries — and then reads the date the other set.
    const now = new Date();
    if (current) {
      await this.settingModel
        .updateOne({ _id: current._id }, { $set: { 'finance.goLiveAt': now } }, { session })
        .exec();
    } else {
      await this.settingModel.create([{ finance: { goLiveAt: now } }], { session });
    }
    return now;
  }

  /**
   * Net balance of each account over entries dated in [from, to). Debit-normal
   * accounts read debits − credits, credit-normal ones credits − debits, so a
   * healthy balance is positive either way.
   */
  async balances(range: { from?: Date; to?: Date } = {}, accounts?: string[]): Promise<Record<string, number>> {
    const match: Record<string, unknown> = {};
    if (range.from || range.to) {
      match.date = {
        ...(range.from ? { $gte: range.from } : {}),
        ...(range.to ? { $lt: range.to } : {}),
      };
    }
    const rows: { _id: string; debit: number; credit: number }[] = await this.entryModel
      .aggregate([
        { $match: match },
        { $unwind: '$lines' },
        ...(accounts ? [{ $match: { 'lines.account': { $in: accounts } } }] : []),
        { $group: { _id: '$lines.account', debit: { $sum: '$lines.debitMinor' }, credit: { $sum: '$lines.creditMinor' } } },
      ])
      .exec();

    const result: Record<string, number> = {};
    for (const code of accounts ?? ACCOUNT_CODES) result[code] = 0;
    for (const row of rows) {
      result[row._id] = isCreditNormal(row._id) ? row.credit - row.debit : row.debit - row.credit;
    }
    return result;
  }

  private assertBalanced(lines: Required<Pick<PostingLine, 'account' | 'debitMinor' | 'creditMinor'>>[]): void {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const sides = [l.debitMinor, l.creditMinor];
      if (!ACCOUNT_CODES.includes(l.account as never)) throw this.bug(`unknown account ${l.account}`);
      if (!sides.every((v) => Number.isSafeInteger(v) && v >= 0)) throw this.bug('amounts must be whole minor units');
      if ((l.debitMinor > 0) === (l.creditMinor > 0)) throw this.bug('each line is a debit or a credit');
      debit += l.debitMinor;
      credit += l.creditMinor;
    }
    if (lines.length < 2 || debit !== credit) throw this.bug(`entry does not balance (${debit} ≠ ${credit})`);
  }

  /** A posting that doesn't balance is a programming error, never the user's. */
  private bug(detail: string) {
    return new InternalServerErrorException(`Journal posting refused: ${detail}`);
  }
}
