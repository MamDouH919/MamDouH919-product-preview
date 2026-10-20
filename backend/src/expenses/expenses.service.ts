import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, QueryFilter, Types } from 'mongoose';
import { TENANT_CONNECTION } from '../common/tenant/tenant.module';
import { withTransaction } from '../common/tenant/with-transaction';
import { MoneyError, parseMoney } from '../common/money/money';
import { safeTimeZone, zonedDayRange } from '../common/helpers/time-zone';
import { Counter } from '../orders/schemas/counter.schema';
import { Order } from '../orders/schemas/order.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { JournalService } from '../finance/journal.service';
import { ACCOUNT } from '../finance/accounts';
import { Expense, ExpenseStatus } from './schemas/expense.schema';
import { CreateExpenseDto, QueryExpensesDto } from './dto/expense.dto';

const EXPENSE_COUNTER = 'expense';
const EXPENSE_NUMBER_BASE = 8000;

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    @Inject(TENANT_CONNECTION) private connection: Connection,
    private readonly journal: JournalService,
  ) {}

  /** Records a cost paid from the store's cash, with its journal entry, in one transaction. */
  async create(dto: CreateExpenseDto, userId?: string): Promise<Expense> {
    let amountMinor: number;
    try {
      amountMinor = parseMoney(dto.amount);
    } catch (error) {
      if (error instanceof MoneyError) throw new BadRequestException(error.message);
      throw error;
    }
    if (amountMinor <= 0) throw new BadRequestException('The amount must be above zero');
    const date = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 60_000) throw new BadRequestException('The date must be today or earlier');

    return withTransaction(this.connection, async (session) => {
      let order: Order | null = null;
      if (dto.orderId) {
        order = await this.orderModel.findById(dto.orderId).select('orderNumber').session(session).exec();
        if (!order) throw new NotFoundException('Order not found');
      }
      const counter = await this.counterModel
        .findOneAndUpdate({ name: EXPENSE_COUNTER }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
        .exec();
      const [expense] = await this.expenseModel.create(
        [
          {
            expenseNumber: EXPENSE_NUMBER_BASE + counter!.seq,
            date,
            account: dto.account,
            amountMinor,
            description: dto.description,
            reference: dto.reference,
            order: order?._id,
            orderNumber: order?.orderNumber,
            courier: dto.courierId ? new Types.ObjectId(dto.courierId) : undefined,
            createdBy: this.userOid(userId),
          },
        ],
        { session },
      );
      await this.journal.post(
        {
          date,
          source: { type: 'expense', id: expense._id as Types.ObjectId, number: expense.expenseNumber, event: 'posted' },
          lines: [
            { account: dto.account, debitMinor: amountMinor, order: order?._id as Types.ObjectId | undefined },
            { account: ACCOUNT.CASH, creditMinor: amountMinor, moneyAccount: await this.journal.moneyAccount(dto.moneyAccountId, session) },
          ],
          memo: dto.description,
          createdBy: userId,
        },
        session,
      );
      return expense;
    });
  }

  /** Undoes an expense recorded by mistake: a reversing entry dated now; the original stays in its period. */
  async reverse(id: string, reason: string, userId?: string): Promise<Expense> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Expense not found');
    return withTransaction(this.connection, async (session) => {
      const now = new Date();
      const expense = await this.expenseModel
        .findOneAndUpdate(
          { _id: id, status: ExpenseStatus.POSTED },
          { $set: { status: ExpenseStatus.REVERSED, reversedAt: now, reversedBy: this.userOid(userId), reverseReason: reason } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!expense) {
        if (!(await this.expenseModel.exists({ _id: id }).session(session))) throw new NotFoundException('Expense not found');
        throw new ConflictException('This expense is already reversed');
      }
      const original = await this.journal.findBySource('expense', expense._id as Types.ObjectId, 'posted', session);
      if (!original) throw new ConflictException(`Expense #${expense.expenseNumber} has no journal entry to reverse`);
      await this.journal.reverse(original, 'reversed', now, session, userId);
      return expense;
    });
  }

  /** Expenses dated in the store's calendar days `from`..`to`, newest first, with totals by category. */
  async list(query: QueryExpensesDto) {
    const settings = await this.settingModel.findOne().select('timezone').lean().exec();
    const { start, end } = zonedDayRange(query.from, query.to, safeTimeZone(settings?.timezone));
    const filter: QueryFilter<Expense> = {};
    if (start || end) filter.date = { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) };
    if (query.account) filter.account = query.account;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [data, total, byAccount] = await Promise.all([
      this.expenseModel.find(filter).sort({ date: -1, expenseNumber: -1 }).skip((page - 1) * limit).limit(limit).populate('createdBy', 'name').exec(),
      this.expenseModel.countDocuments(filter).exec(),
      this.expenseModel
        .aggregate<{ _id: string; totalMinor: number }>([
          { $match: { ...(filter as Record<string, unknown>), status: ExpenseStatus.POSTED } },
          { $group: { _id: '$account', totalMinor: { $sum: '$amountMinor' } } },
        ])
        .exec(),
    ]);
    return { data, total, page, limit, totalsByAccount: Object.fromEntries(byAccount.map((r) => [r._id, r.totalMinor])) };
  }

  private userOid(userId?: string) {
    return userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;
  }
}
