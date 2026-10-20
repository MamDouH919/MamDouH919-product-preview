import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JournalEntry } from './schemas/journal-entry.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Purchase, PurchaseStatus } from '../purchasing/schemas/purchase.schema';
import { Refund, RefundStatus } from '../refunds/schemas/refund.schema';
import { MoneyAccount } from '../money-accounts/schemas/money-account.schema';
import { ACCOUNT, AccountType, CHART, EXPENSE_ACCOUNTS, isCreditNormal } from './accounts';
import { FinanceReportsService } from './finance-reports.service';
import { JournalService } from './journal.service';
import { outstandingOf, orderAmounts } from './order-money';
import { zonedDayRange } from '../common/helpers/time-zone';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Age buckets for what is owed, in days. */
export const AGE_BUCKETS = [
  { key: '0_7', max: 7 },
  { key: '8_30', max: 30 },
  { key: '31_60', max: 60 },
  { key: '61_plus', max: Infinity },
] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number]['key'];

const bucketOf = (days: number): AgeBucket => AGE_BUCKETS.find((b) => days <= b.max)!.key;
const emptyBuckets = () => Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0])) as Record<AgeBucket, number>;
const nameOf = (code: string) => CHART.find((a) => a.code === code)?.name ?? { en: code, ar: code };

/**
 * The financial statements, each a view of the journal — so they agree with
 * one another and with the reconciliation. All amounts are minor units;
 * periods are calendar days in the store's time zone.
 */
@Injectable()
export class StatementsService {
  constructor(
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Purchase.name) private purchaseModel: Model<Purchase>,
    @InjectModel(Refund.name) private refundModel: Model<Refund>,
    @InjectModel(MoneyAccount.name) private moneyAccountModel: Model<MoneyAccount>,
    private readonly reports: FinanceReportsService,
    private readonly journal: JournalService,
  ) {}

  private async range(from?: string, to?: string) {
    const { timeZone } = await this.reports.storeClock();
    return { timeZone, ...zonedDayRange(from, to, timeZone) };
  }

  /**
   * Profit and loss for a period, account by account, with the same number of
   * days just before it for comparison when the period is bounded.
   */
  async profitAndLoss(from?: string, to?: string) {
    const { start, end, timeZone } = await this.range(from, to);
    const previous = start && end ? { start: new Date(start.getTime() - (end.getTime() - start.getTime())), end: start } : undefined;

    const [current, prior, figures, priorFigures] = await Promise.all([
      this.journal.balances({ from: start, to: end }),
      previous ? this.journal.balances({ from: previous.start, to: previous.end }) : Promise.resolve(undefined),
      this.reports.period(start, end),
      previous ? this.reports.period(previous.start, previous.end) : Promise.resolve(undefined),
    ]);

    const section = (types: AccountType[]) =>
      CHART.filter((a) => types.includes(a.type))
        .map((a) => ({ code: a.code, name: a.name, type: a.type, amountMinor: current[a.code] ?? 0, previousMinor: prior?.[a.code] }))
        .filter((l) => l.amountMinor !== 0 || (l.previousMinor ?? 0) !== 0);

    return {
      from,
      to,
      timeZone,
      periodStart: start,
      periodEnd: end,
      previousStart: previous?.start,
      revenue: section([AccountType.REVENUE, AccountType.CONTRA_REVENUE]),
      costOfSales: section([AccountType.COST_OF_SALES]),
      expenses: section([AccountType.EXPENSE]),
      totals: figures,
      previousTotals: priorFigures,
    };
  }

  /**
   * Cash flow by the direct method: every movement of the store's money in
   * the period, by what caused it, with the opening and closing balance of
   * each money account. Transfers between accounts move nothing overall.
   */
  async cashFlow(from?: string, to?: string) {
    const { start, end, timeZone } = await this.range(from, to);
    const date: Record<string, Date> = {};
    if (start) date.$gte = start;
    if (end) date.$lt = end;

    const entries = await this.entryModel
      .find({ ...(start || end ? { date } : {}), 'lines.account': ACCOUNT.CASH })
      .select('source lines')
      .lean()
      .exec();

    const flows = new Map<string, number>();
    for (const e of entries) {
      const cash = e.lines.filter((l) => l.account === ACCOUNT.CASH).reduce((t, l) => t + l.debitMinor - l.creditMinor, 0);
      if (!cash) continue;
      // Expenses show by their category; everything else by what caused it.
      const expenseLine = e.source.type === 'expense' ? e.lines.find((l) => EXPENSE_ACCOUNTS.includes(l.account as never)) : undefined;
      const key = expenseLine ? `expense:${expenseLine.account}` : e.source.type;
      flows.set(key, (flows.get(key) ?? 0) + cash);
    }

    const accounts = await this.moneyAccountModel.find().sort({ isDefault: -1, name: 1 }).lean().exec();
    const balanceAt = async (before?: Date) => {
      const rows = await this.entryModel
        .aggregate<{ _id: Types.ObjectId | null; balance: number }>([
          ...(before ? [{ $match: { date: { $lt: before } } }] : []),
          { $unwind: '$lines' },
          { $match: { 'lines.account': ACCOUNT.CASH } },
          { $group: { _id: '$lines.moneyAccount', balance: { $sum: { $subtract: ['$lines.debitMinor', '$lines.creditMinor'] } } } },
        ])
        .exec();
      return new Map(rows.map((r) => [String(r._id), r.balance]));
    };
    const [opening, closing] = await Promise.all([start ? balanceAt(start) : Promise.resolve(new Map<string, number>()), balanceAt(end)]);

    const lines = [...flows.entries()]
      .map(([key, amountMinor]) => ({
        key,
        name: key.startsWith('expense:') ? nameOf(key.slice('expense:'.length)) : undefined,
        amountMinor,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor);
    const net = lines.reduce((t, l) => t + l.amountMinor, 0);
    const byAccount = accounts.map((a) => ({
      _id: a._id,
      name: a.name,
      type: a.type,
      openingMinor: opening.get(String(a._id)) ?? 0,
      closingMinor: closing.get(String(a._id)) ?? 0,
    }));
    return {
      from,
      to,
      timeZone,
      lines,
      inflowMinor: lines.filter((l) => l.amountMinor > 0).reduce((t, l) => t + l.amountMinor, 0),
      outflowMinor: -lines.filter((l) => l.amountMinor < 0).reduce((t, l) => t + l.amountMinor, 0),
      netMinor: net,
      openingMinor: byAccount.reduce((t, a) => t + a.openingMinor, 0),
      closingMinor: byAccount.reduce((t, a) => t + a.closingMinor, 0),
      accounts: byAccount,
    };
  }

  /** What customers owe now, order by order, aged from delivery. */
  async receivables() {
    const now = Date.now();
    const orders = await this.orderModel
      .find({ bookedAt: { $exists: true }, status: OrderStatus.DELIVERED })
      .populate<{ customer: { name?: string; email?: string } }>('customer', 'name email')
      .lean()
      .exec();
    const buckets = emptyBuckets();
    const rows = orders
      .map((o) => {
        const totalMinor = orderAmounts(o).totalMinor;
        const owed = outstandingOf(totalMinor, o.money);
        const days = Math.floor((now - new Date(o.deliveredAt ?? o.bookedAt!).getTime()) / DAY_MS);
        return {
          orderId: o._id,
          orderNumber: o.orderNumber,
          customer: o.customer?.name ?? o.shippingAddress.fullName,
          phone: o.shippingAddress.phone,
          deliveredAt: o.deliveredAt,
          totalMinor,
          collectedMinor: o.money?.collectedMinor ?? 0,
          owedMinor: owed,
          days,
          bucket: bucketOf(days),
        };
      })
      .filter((r) => r.owedMinor > 0)
      .sort((a, b) => b.days - a.days);
    for (const r of rows) buckets[r.bucket] += r.owedMinor;
    return { asOf: new Date(now), rows, buckets, totalMinor: rows.reduce((t, r) => t + r.owedMinor, 0) };
  }

  /** What the store owes suppliers now, purchase by purchase, aged from receipt (or past their due date). */
  async payables() {
    const now = Date.now();
    const purchases = await this.purchaseModel
      .find({ status: PurchaseStatus.POSTED })
      .populate<{ supplier: { name?: string } }>('supplier', 'name')
      .lean()
      .exec();
    const buckets = emptyBuckets();
    const rows = purchases
      .map((p) => {
        const owed = p.totalMinor - p.paidMinor - p.returnedMinor;
        const days = Math.floor((now - new Date(p.date).getTime()) / DAY_MS);
        const overdueDays = p.dueDate ? Math.floor((now - new Date(p.dueDate).getTime()) / DAY_MS) : undefined;
        return {
          purchaseId: p._id,
          purchaseNumber: p.purchaseNumber,
          supplier: p.supplier?.name,
          supplierInvoiceNo: p.supplierInvoiceNo,
          date: p.date,
          dueDate: p.dueDate,
          totalMinor: p.totalMinor,
          owedMinor: owed,
          days,
          overdueDays: overdueDays !== undefined && overdueDays > 0 ? overdueDays : 0,
          bucket: bucketOf(days),
        };
      })
      .filter((r) => r.owedMinor > 0)
      .sort((a, b) => b.days - a.days);
    for (const r of rows) buckets[r.bucket] += r.owedMinor;
    return { asOf: new Date(now), rows, buckets, totalMinor: rows.reduce((t, r) => t + r.owedMinor, 0) };
  }

  /**
   * Every account's debits, credits and balance up to the end of `asOf`
   * (inclusive, store time). Total debits equal total credits, or the books
   * are broken.
   */
  async trialBalance(asOf?: string) {
    const { end, timeZone } = await this.range(undefined, asOf);
    const rows = await this.entryModel
      .aggregate<{ _id: string; debit: number; credit: number }>([
        ...(end ? [{ $match: { date: { $lt: end } } }] : []),
        { $unwind: '$lines' },
        { $group: { _id: '$lines.account', debit: { $sum: '$lines.debitMinor' }, credit: { $sum: '$lines.creditMinor' } } },
      ])
      .exec();
    const byCode = new Map(rows.map((r) => [r._id, r]));
    const accounts = CHART.map((a) => {
      const r = byCode.get(a.code);
      const debit = r?.debit ?? 0;
      const credit = r?.credit ?? 0;
      return {
        code: a.code,
        name: a.name,
        type: a.type,
        debitMinor: debit,
        creditMinor: credit,
        balanceMinor: isCreditNormal(a.code) ? credit - debit : debit - credit,
      };
    }).filter((a) => a.debitMinor || a.creditMinor);
    const totalDebitMinor = accounts.reduce((t, a) => t + a.debitMinor, 0);
    const totalCreditMinor = accounts.reduce((t, a) => t + a.creditMinor, 0);
    return { asOf, timeZone, accounts, totalDebitMinor, totalCreditMinor, balanced: totalDebitMinor === totalCreditMinor };
  }

  /**
   * Per product: what was delivered in the period (units, net sales after the
   * line's share of the discount, cost, margin) and what was refunded in it.
   */
  async salesByProduct(from?: string, to?: string) {
    const { start, end, timeZone } = await this.range(from, to);
    const when = (field: string) => (start || end ? { [field]: { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) } } : {});

    const [sold, refunded] = await Promise.all([
      this.orderModel
        .aggregate<{ _id: { product: Types.ObjectId; variantId?: Types.ObjectId }; name: Record<string, string>; variantLabel?: string; units: number; netMinor: number; costMinor: number; uncosted: number }>([
          { $match: { bookedAt: { $exists: true }, ...when('bookedAt') } },
          { $unwind: '$items' },
          {
            $group: {
              _id: { product: '$items.product', variantId: '$items.variantId' },
              name: { $last: '$items.name' },
              variantLabel: { $last: '$items.variantLabel' },
              units: { $sum: '$items.quantity' },
              netMinor: { $sum: { $subtract: ['$items.lineTotalMinor', { $ifNull: ['$items.discountMinor', 0] }] } },
              costMinor: { $sum: { $ifNull: ['$items.costMinor', 0] } },
              uncosted: { $sum: { $cond: [{ $eq: [{ $type: '$items.costMinor' }, 'missing'] }, '$items.quantity', 0] } },
            },
          },
        ])
        .exec(),
      this.refundModel
        .aggregate<{ _id: { product: Types.ObjectId; variantId?: Types.ObjectId }; units: number; refundedMinor: number }>([
          { $match: { status: RefundStatus.EXECUTED, ...when('executedAt') } },
          { $unwind: '$lines' },
          { $group: { _id: { product: '$lines.product', variantId: '$lines.variantId' }, units: { $sum: '$lines.quantity' }, refundedMinor: { $sum: '$lines.amountMinor' } } },
        ])
        .exec(),
    ]);

    const key = (id: { product: Types.ObjectId; variantId?: Types.ObjectId }) => `${id.product}:${id.variantId ?? ''}`;
    const refunds = new Map(refunded.map((r) => [key(r._id), r]));
    const rows = sold.map((s) => {
      const r = refunds.get(key(s._id));
      refunds.delete(key(s._id));
      return {
        productId: s._id.product,
        variantId: s._id.variantId,
        name: s.name,
        variantLabel: s.variantLabel,
        units: s.units,
        netSalesMinor: s.netMinor,
        costMinor: s.costMinor,
        marginMinor: s.netMinor - s.costMinor,
        uncostedUnits: s.uncosted,
        refundedUnits: r?.units ?? 0,
        refundedMinor: r?.refundedMinor ?? 0,
      };
    });
    // Refunds in the period for products not sold in it.
    for (const r of refunds.values()) {
      rows.push({ productId: r._id.product, variantId: r._id.variantId, name: {}, variantLabel: undefined, units: 0, netSalesMinor: 0, costMinor: 0, marginMinor: 0, uncostedUnits: 0, refundedUnits: r.units, refundedMinor: r.refundedMinor });
    }
    rows.sort((a, b) => b.netSalesMinor - a.netSalesMinor);
    return { from, to, timeZone, rows };
  }
}
