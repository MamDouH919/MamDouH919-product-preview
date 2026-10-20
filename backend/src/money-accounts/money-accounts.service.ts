import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { formatMinor, MoneyError, parseMoney } from '../common/money/money';
import { Counter } from '../orders/schemas/counter.schema';
import { JournalEntry } from '../finance/schemas/journal-entry.schema';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { MoneyAccount } from './schemas/money-account.schema';
import { MoneyTransfer } from './schemas/money-transfer.schema';
import { CreateMoneyAccountDto, TransferMoneyDto, UpdateMoneyAccountDto } from './dto/money-account.dto';

const TRANSFER_COUNTER = 'money_transfer';
const TRANSFER_NUMBER_BASE = 9000;

@Injectable()
export class MoneyAccountsService {
  constructor(
    @InjectModel(MoneyAccount.name) private accountModel: Model<MoneyAccount>,
    @InjectModel(MoneyTransfer.name) private transferModel: Model<MoneyTransfer>,
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
  ) {}

  /** Every account with its balance now; the books' cash account is their sum. */
  async list() {
    // Make sure the main cash box exists, so a new store sees where money will go.
    await withTransaction(this.connection, (session) => this.journal.defaultMoneyAccount(session));
    const [accounts, balances] = await Promise.all([this.accountModel.find().sort({ isDefault: -1, name: 1 }).lean().exec(), this.balances()]);
    return accounts.map((a) => ({ ...a, balanceMinor: balances.get(String(a._id)) ?? 0 }));
  }

  create(dto: CreateMoneyAccountDto) {
    return this.accountModel.create({ ...dto, isDefault: false });
  }

  /** Renames, deactivates, or makes an account the default — only one default at a time. */
  async update(id: string, dto: UpdateMoneyAccountDto) {
    return withTransaction(this.connection, async (session) => {
      const account = await this.accountModel.findById(this.oid(id)).session(session).exec();
      if (!account) throw new NotFoundException('Money account not found');
      if (dto.isActive === false && (account.isDefault || dto.isDefault)) throw new BadRequestException('The default account must stay active');
      if (dto.isActive === false) {
        const balance = (await this.balances(session)).get(String(account._id)) ?? 0;
        if (balance !== 0) throw new ConflictException(`It still holds ${formatMinor(balance)}; move it to another account first`);
      }
      if (dto.isDefault === false && account.isDefault) throw new BadRequestException('Make another account the default instead');
      if (dto.isDefault && !account.isDefault) {
        await this.accountModel.updateMany({ isDefault: true }, { $set: { isDefault: false } }, { session }).exec();
      }
      return (await this.accountModel
        .findByIdAndUpdate(account._id, { $set: dto }, { returnDocument: 'after', session })
        .lean()
        .exec())!;
    });
  }

  /** Moves money between two accounts. Never more than the one it leaves holds. */
  async transfer(dto: TransferMoneyDto, userId?: string) {
    let amountMinor: number;
    try {
      amountMinor = parseMoney(dto.amount);
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(error.message);
      throw error;
    }
    if (amountMinor <= 0) throw new BadRequestException('The amount must be above zero');
    if (dto.fromId === dto.toId) throw new BadRequestException('Pick two different accounts');
    const date = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 60_000) throw new BadRequestException('The date must be today or earlier');

    return withTransaction(this.connection, async (session) => {
      const [from, to] = await Promise.all([this.journal.moneyAccount(dto.fromId, session), this.journal.moneyAccount(dto.toId, session)]);
      const held = (await this.balances(session)).get(String(from)) ?? 0;
      if (amountMinor > held) throw new BadRequestException(`That account holds only ${formatMinor(held)}`);

      const counter = await this.counterModel
        .findOneAndUpdate({ name: TRANSFER_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
        .exec();
      const [transfer] = await this.transferModel.create(
        [{ transferNumber: TRANSFER_NUMBER_BASE + counter!.seq, from, to, amountMinor, date, note: dto.note, createdBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined }],
        { session },
      );
      await this.journal.post(
        {
          date,
          source: { type: 'money_transfer', id: transfer._id as Types.ObjectId, number: transfer.transferNumber, event: 'moved' },
          lines: [
            { account: ACCOUNT.CASH, debitMinor: amountMinor, moneyAccount: to },
            { account: ACCOUNT.CASH, creditMinor: amountMinor, moneyAccount: from },
          ],
          memo: dto.note ?? 'Transfer between accounts',
          createdBy: userId,
        },
        session,
      );
      return transfer;
    });
  }

  /** Balance of each money account: debits − credits of its cash lines. */
  async balances(session?: ClientSession): Promise<Map<string, number>> {
    const rows = await this.entryModel
      .aggregate<{ _id: Types.ObjectId | null; balance: number }>([
        { $unwind: '$lines' },
        { $match: { 'lines.account': ACCOUNT.CASH } },
        { $group: { _id: '$lines.moneyAccount', balance: { $sum: { $subtract: ['$lines.debitMinor', '$lines.creditMinor'] } } } },
      ])
      .session(session ?? null)
      .exec();
    return new Map(rows.map((r) => [String(r._id), r.balance]));
  }

  private oid(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Money account not found');
    return new Types.ObjectId(id);
  }
}
