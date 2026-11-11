import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JournalEntry } from './schemas/journal-entry.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Purchase, PurchaseStatus } from '../purchasing/schemas/purchase.schema';
import { Refund, RefundStatus } from '../refunds/schemas/refund.schema';
import { MoneyAccount } from '../money-accounts/schemas/money-account.schema';
import { ACCOUNT, AccountCategory, AccountType, CashFlowActivity, ChartAccount, EXPENSE_ACCOUNTS } from './accounts';
import { accountBalance } from './account-balance';
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
const nameIn = (chart: Map<string, ChartAccount>, code: string) => chart.get(code)?.name ?? { en: code, ar: code };
const ACTIVITIES = [CashFlowActivity.OPERATING, CashFlowActivity.INVESTING, CashFlowActivity.FINANCING];

/**
 * Splits `amount` across `weights` in proportion, in whole minor units that
 * add up exactly (largest remainder). Used to say which counterpart account
 * a cash movement was for when an entry has several.
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((t, w) => t + w, 0);
  if (!total) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const floors = raw.map((r) => Math.trunc(r));
  let left = amount - floors.reduce((t, f) => t + f, 0);
  const order = raw.map((r, i) => ({ i, frac: Math.abs(r - floors[i]) })).sort((a, b) => b.frac - a.frac);
  const step = Math.sign(left);
  for (const { i } of order) {
    if (!left) break;
    floors[i] += step;
    left -= step;
  }
  return floors;
}

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

    const [current, prior, figures, priorFigures, chart] = await Promise.all([
      this.journal.balances({ from: start, to: end }),
      previous ? this.journal.balances({ from: previous.start, to: previous.end }) : Promise.resolve(undefined),
      this.reports.period(start, end),
      previous ? this.reports.period(previous.start, previous.end) : Promise.resolve(undefined),
      this.journal.chart(),
    ]);

    const section = (types: AccountType[]) =>
      chart
        .filter((a) => types.includes(a.type))
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
   * the period, by what caused it, under operating, investing and financing
   * activities, with the opening and closing balance of each money account.
   * Transfers between accounts move nothing overall.
   *
   * Each entry's cash is split across the accounts on its other side, and
   * each of those says which activity it belongs to — so a manual entry that
   * borrows from a bank shows as financing, one that buys equipment as
   * investing. Entries from business events are labelled by their source.
   */
  async cashFlow(from?: string, to?: string) {
    const { start, end, timeZone } = await this.range(from, to);
    const date: Record<string, Date> = {};
    if (start) date.$gte = start;
    if (end) date.$lt = end;

    const [entries, chart] = await Promise.all([
      this.entryModel
        .find({ ...(start || end ? { date } : {}), 'lines.account': ACCOUNT.CASH })
        .select('source lines')
        .lean()
        .exec(),
      this.journal.chartByCode(),
    ]);

    const flows = new Map<string, { activity: CashFlowActivity; amountMinor: number }>();
    const add = (key: string, activity: CashFlowActivity, amount: number) => {
      const id = `${activity}|${key}`;
      const current = flows.get(id) ?? { activity, amountMinor: 0 };
      current.amountMinor += amount;
      flows.set(id, current);
    };
    for (const e of entries) {
      const cash = e.lines.filter((l) => l.account === ACCOUNT.CASH).reduce((t, l) => t + l.debitMinor - l.creditMinor, 0);
      if (!cash) continue;
      const others = e.lines.filter((l) => l.account !== ACCOUNT.CASH);
      // Money in came from the lines credited; money out went to the lines debited.
      const weights = others.map((l) => Math.max(0, cash > 0 ? l.creditMinor - l.debitMinor : l.debitMinor - l.creditMinor));
      const shares = allocate(Math.abs(cash), weights);
      if (!shares.some(Boolean)) {
        add(e.source.type, CashFlowActivity.OPERATING, cash);
        continue;
      }
      others.forEach((l, i) => {
        if (!shares[i]) return;
        const activity = chart.get(l.account)?.cashFlowActivity ?? CashFlowActivity.OPERATING;
        const key =
          e.source.type === 'manual'
            ? `account:${l.account}`
            : e.source.type === 'expense' && EXPENSE_ACCOUNTS.includes(l.account as never)
              ? `expense:${l.account}`
              : e.source.type;
        add(key, activity, Math.sign(cash) * shares[i]);
      });
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
      .map(([id, f]) => {
        const key = id.slice(id.indexOf('|') + 1);
        const code = key.startsWith('expense:') || key.startsWith('account:') ? key.slice(key.indexOf(':') + 1) : undefined;
        return { key, activity: f.activity, name: code ? nameIn(chart, code) : undefined, code, amountMinor: f.amountMinor };
      })
      .filter((l) => l.amountMinor !== 0)
      .sort((a, b) => b.amountMinor - a.amountMinor);
    const sections = ACTIVITIES.map((activity) => {
      const mine = lines.filter((l) => l.activity === activity);
      return { activity, lines: mine, netMinor: mine.reduce((t, l) => t + l.amountMinor, 0) };
    });
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
      sections,
      inflowMinor: lines.filter((l) => l.amountMinor > 0).reduce((t, l) => t + l.amountMinor, 0),
      outflowMinor: -lines.filter((l) => l.amountMinor < 0).reduce((t, l) => t + l.amountMinor, 0),
      netMinor: net,
      openingMinor: byAccount.reduce((t, a) => t + a.openingMinor, 0),
      closingMinor: byAccount.reduce((t, a) => t + a.closingMinor, 0),
      accounts: byAccount,
    };
  }

  /**
   * The balance sheet at the end of `asOf` (inclusive, store time): what the
   * store has (assets), what it owes (liabilities) and what is the owner's
   * (equity). Profit not yet closed into equity — revenue less costs and
   * expenses since the books began — is shown as current earnings, so
   * assets = liabilities + equity whenever the books balance.
   */
  async balanceSheet(asOf?: string) {
    const { end, timeZone } = await this.range(undefined, asOf);
    const [rows, chart, booksStartedAt] = await Promise.all([
      this.entryModel
        .aggregate<{ _id: string; debit: number; credit: number }>([
          ...(end ? [{ $match: { date: { $lt: end } } }] : []),
          { $unwind: '$lines' },
          { $group: { _id: '$lines.account', debit: { $sum: '$lines.debitMinor' }, credit: { $sum: '$lines.creditMinor' } } },
        ])
        .exec(),
      this.journal.chart(),
      this.reports.storeClock().then((c) => c.booksStartedAt),
    ]);
    const byCode = new Map(rows.map((r) => [r._id, r]));
    /** Positive on the account's normal side. */
    const balanceOf = (a: ChartAccount) => {
      const r = byCode.get(a.code);
      const diff = (r?.debit ?? 0) - (r?.credit ?? 0);
      return a.normalSide === 'debit' ? diff : -diff;
    };
    const section = (category: AccountCategory) => {
      const lines = chart
        .filter((a) => a.category === category)
        .map((a) => ({ code: a.code, name: a.name, type: a.type, amountMinor: balanceOf(a) }))
        .filter((l) => l.amountMinor !== 0);
      return { lines, totalMinor: lines.reduce((t, l) => t + l.amountMinor, 0) };
    };
    const assets = section(AccountCategory.ASSETS);
    const liabilities = section(AccountCategory.LIABILITIES);
    const equity = section(AccountCategory.EQUITY);
    // Revenue less its contra accounts, cost of sales and expenses — all signed to their normal side.
    const earnings = chart
      .filter((a) => a.category === AccountCategory.REVENUE || a.category === AccountCategory.EXPENSES)
      .reduce((t, a) => {
        const b = balanceOf(a);
        return t + (a.type === AccountType.REVENUE ? b : -b);
      }, 0);
    const totalEquityMinor = equity.totalMinor + earnings;
    const totalLiabilitiesAndEquityMinor = liabilities.totalMinor + totalEquityMinor;
    return {
      asOf,
      timeZone,
      booksStartedAt,
      assets,
      liabilities,
      equity: { ...equity, currentEarningsMinor: earnings, totalMinor: totalEquityMinor },
      totalAssetsMinor: assets.totalMinor,
      totalLiabilitiesAndEquityMinor,
      balanced: assets.totalMinor === totalLiabilitiesAndEquityMinor,
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
   * Every account for the period [from, to] (whole days, store time):
   * - opening: the net balance of everything before `from`, on the side it falls;
   * - period: the debits and credits posted within the period;
   * - closing: opening + period, netted to one side.
   * `debitMinor`/`creditMinor` and the balance fields cover everything up to the
   * end of `to`. Each pair of columns totals equal, or the books are broken.
   */
  async trialBalance(from?: string, to?: string) {
    const { start, end, timeZone } = await this.range(from, to);
    const before = start ? { $lt: ['$date', start] } : false;
    const rows = await this.entryModel
      .aggregate<{ _id: string; openingDebit: number; openingCredit: number; debit: number; credit: number }>([
        ...(end ? [{ $match: { date: { $lt: end } } }] : []),
        { $unwind: '$lines' },
        {
          $group: {
            _id: '$lines.account',
            openingDebit: { $sum: { $cond: [before, '$lines.debitMinor', 0] } },
            openingCredit: { $sum: { $cond: [before, '$lines.creditMinor', 0] } },
            debit: { $sum: '$lines.debitMinor' },
            credit: { $sum: '$lines.creditMinor' },
          },
        },
      ])
      .exec();
    const byCode = new Map(rows.map((r) => [r._id, r]));
    const chart = await this.journal.chart();
    const net = (debit: number, credit: number) => ({ debitMinor: Math.max(debit - credit, 0), creditMinor: Math.max(credit - debit, 0) });
    const accounts = chart
      .map((a) => {
        const r = byCode.get(a.code);
        const debit = r?.debit ?? 0;
        const credit = r?.credit ?? 0;
        const openingDebit = r?.openingDebit ?? 0;
        const openingCredit = r?.openingCredit ?? 0;
        return {
          code: a.code,
          name: a.name,
          type: a.type,
          category: a.category,
          isSystem: a.isSystem,
          opening: net(openingDebit, openingCredit),
          period: { debitMinor: debit - openingDebit, creditMinor: credit - openingCredit },
          closing: net(debit, credit),
          debitMinor: debit,
          creditMinor: credit,
          ...accountBalance(a.type, debit, credit),
        };
      })
      .filter((a) => a.debitMinor || a.creditMinor);
    const sum = (pick: (a: (typeof accounts)[number]) => { debitMinor: number; creditMinor: number }) =>
      accounts.reduce((t, a) => ({ debitMinor: t.debitMinor + pick(a).debitMinor, creditMinor: t.creditMinor + pick(a).creditMinor }), { debitMinor: 0, creditMinor: 0 });
    const totals = { opening: sum((a) => a.opening), period: sum((a) => a.period), closing: sum((a) => a.closing) };
    const totalDebitMinor = accounts.reduce((t, a) => t + a.debitMinor, 0);
    const totalCreditMinor = accounts.reduce((t, a) => t + a.creditMinor, 0);
    const balanced = totalDebitMinor === totalCreditMinor && Object.values(totals).every((x) => x.debitMinor === x.creditMinor);
    return { from, to, asOf: to, timeZone, accounts, totals, totalDebitMinor, totalCreditMinor, balanced };
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
