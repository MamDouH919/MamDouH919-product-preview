import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { JournalEntry } from './schemas/journal-entry.schema';
import { Order } from '../orders/schemas/order.schema';
import { Setting } from '../settings/schemas/setting.schema';
import { ACCOUNT, OPERATING_EXPENSE_ACCOUNTS } from './accounts';
import { JournalService } from './journal.service';
import { safeTimeZone, zonedDayRange } from '../common/helpers/time-zone';

/**
 * One period's figures, all in minor units, each a sum of journal lines dated
 * in [start, end) — the formulas of the finance specification, section 6.
 */
export interface PeriodFigures {
  /** Credits to product sales: subtotals of orders delivered in the period. */
  grossProductSalesMinor: number;
  discountsMinor: number;
  /** Refunds executed in the period (from step 3). */
  productReturnsMinor: number;
  netProductSalesMinor: number;
  /** Delivery fees charged, less delivery-fee refunds. */
  deliveryIncomeMinor: number;
  /** Net product sales + delivery income. Never an order total. */
  netRevenueMinor: number;
  /** Cost of goods sold (net of restocked returns) plus inventory losses and stock-take differences. */
  costOfSalesMinor: number;
  /** Net revenue − cost of sales. Understated cost (so overstated profit) while `uncostedLines` > 0. */
  grossProfitMinor: number;
  /**
   * Order lines delivered in the period whose stock had no cost yet — sold
   * from stock that predates the books, or untracked products. Their cost is
   * missing from cost of sales, so gross profit is not complete while this is
   * above zero.
   */
  uncostedLines: number;
  deliveryCostsMinor: number;
  /** Gross profit − delivery costs: what selling and delivering left over. */
  contributionMinor: number;
  /** Rent, salaries, marketing and the rest, plus write-offs and cash differences. */
  operatingExpensesMinor: number;
  /** Contribution − operating expenses. Before tax (none configured). */
  netProfitMinor: number;
  /** Cash in − cash out of the store's cash in the period: collections, settlements, refunds, expenses, supplier payments. */
  netCashFlowMinor: number;
  /** Cash taken from customers in the period, by store staff or couriers. */
  collectedMinor: number;
  /** Of that, what went straight into the store's cash. */
  cashReceivedByStoreMinor: number;
  /** Refunds paid out in the period, from the store's cash or a courier's. */
  refundsPaidOutMinor: number;
  /** Refunds taken off what customers owed instead of paid out. */
  refundsCreditedMinor: number;
  /** Product returns ÷ gross product sales, in basis points (1 % = 100); 0 with no sales. */
  refundRateBasisPoints: number;
  deliveredOrders: number;
  /** (Gross product sales − discounts + delivery income) ÷ delivered orders; 0 when none. */
  averageOrderValueMinor: number;
}

export interface FinanceSummary extends PeriodFigures {
  from?: string;
  to?: string;
  timeZone: string;
  periodStart?: Date;
  periodEnd?: Date;
  /** Balances at the end of the period. */
  receivablesMinor: number;
  courierCustodyMinor: number;
  /** When this store's books began; nothing before it is in these figures. */
  booksStartedAt?: Date;
}

@Injectable()
export class FinanceReportsService {
  constructor(
    @InjectModel(JournalEntry.name) private entryModel: Model<JournalEntry>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
    private readonly journal: JournalService,
  ) {}

  /** The store's zone and the day its books began. */
  async storeClock(): Promise<{ timeZone: string; booksStartedAt?: Date }> {
    const settings = await this.settingModel.findOne().select('timezone finance').lean().exec();
    return { timeZone: safeTimeZone(settings?.timezone), booksStartedAt: settings?.finance?.goLiveAt };
  }

  /** Figures for calendar days `from`..`to` (inclusive) in the store's zone, plus balances at the end. */
  async summary(from?: string, to?: string): Promise<FinanceSummary> {
    const { timeZone, booksStartedAt } = await this.storeClock();
    const { start, end } = zonedDayRange(from, to, timeZone);
    const [figures, balances] = await Promise.all([
      this.period(start, end),
      this.journal.balances({ to: end }, [ACCOUNT.RECEIVABLES, ACCOUNT.COURIER_CASH]),
    ]);
    return {
      from,
      to,
      timeZone,
      periodStart: start,
      periodEnd: end,
      ...figures,
      receivablesMinor: balances[ACCOUNT.RECEIVABLES],
      courierCustodyMinor: balances[ACCOUNT.COURIER_CASH],
      booksStartedAt,
    };
  }

  /** Every figure for entries dated in [start, end); either end may be open. */
  async period(start?: Date, end?: Date): Promise<PeriodFigures> {
    const date: Record<string, Date> = {};
    if (start) date.$gte = start;
    if (end) date.$lt = end;
    const match = start || end ? { date } : {};

    const [rows, delivered, uncosted] = await Promise.all([
      this.entryModel
        .aggregate<{ _id: { account: string; source: string }; debit: number; credit: number }>([
          { $match: match },
          { $unwind: '$lines' },
          {
            $group: {
              _id: { account: '$lines.account', source: '$source.type' },
              debit: { $sum: '$lines.debitMinor' },
              credit: { $sum: '$lines.creditMinor' },
            },
          },
        ])
        .exec(),
      this.orderModel.countDocuments({ bookedAt: match.date ?? { $exists: true } }).exec(),
      this.orderModel
        .aggregate<{ n: number }>([
          { $match: { bookedAt: match.date ?? { $exists: true } } },
          { $unwind: '$items' },
          { $match: { 'items.costMinor': { $exists: false } } },
          { $count: 'n' },
        ])
        .exec(),
    ]);

    const net = (account: string, side: 'credit' | 'debit', source?: string) =>
      rows
        .filter((r) => r._id.account === account && (!source || r._id.source === source))
        .reduce((sum, r) => sum + (side === 'credit' ? r.credit - r.debit : r.debit - r.credit), 0);

    const gross = net(ACCOUNT.PRODUCT_SALES, 'credit');
    const discounts = net(ACCOUNT.SALES_DISCOUNTS, 'debit');
    const returns = net(ACCOUNT.SALES_RETURNS, 'debit');
    const delivery = net(ACCOUNT.DELIVERY_INCOME, 'credit') - net(ACCOUNT.DELIVERY_REFUNDS, 'debit');
    const netProduct = gross - discounts - returns;
    const deliveryCharged = net(ACCOUNT.DELIVERY_INCOME, 'credit');
    const costOfSales = net(ACCOUNT.COGS, 'debit') + net(ACCOUNT.INVENTORY_LOSSES, 'debit');
    const deliveryCosts = net(ACCOUNT.DELIVERY_COSTS, 'debit');
    const operatingExpenses = OPERATING_EXPENSE_ACCOUNTS.reduce((t, account) => t + net(account, 'debit'), 0);
    const grossProfit = netProduct + delivery - costOfSales;

    return {
      grossProductSalesMinor: gross,
      discountsMinor: discounts,
      productReturnsMinor: returns,
      netProductSalesMinor: netProduct,
      deliveryIncomeMinor: delivery,
      netRevenueMinor: netProduct + delivery,
      costOfSalesMinor: costOfSales,
      grossProfitMinor: grossProfit,
      uncostedLines: uncosted[0]?.n ?? 0,
      deliveryCostsMinor: deliveryCosts,
      contributionMinor: grossProfit - deliveryCosts,
      operatingExpensesMinor: operatingExpenses,
      netProfitMinor: grossProfit - deliveryCosts - operatingExpenses,
      netCashFlowMinor: net(ACCOUNT.CASH, 'debit'),
      collectedMinor: net(ACCOUNT.RECEIVABLES, 'credit', 'payment'),
      cashReceivedByStoreMinor: net(ACCOUNT.CASH, 'debit', 'payment'),
      refundsPaidOutMinor: net(ACCOUNT.CASH, 'credit', 'refund') + net(ACCOUNT.COURIER_CASH, 'credit', 'refund'),
      refundsCreditedMinor: net(ACCOUNT.RECEIVABLES, 'credit', 'refund'),
      refundRateBasisPoints: gross > 0 ? Math.round((returns * 10_000) / gross) : 0,
      deliveredOrders: delivered,
      averageOrderValueMinor: delivered ? Math.round((gross - discounts + deliveryCharged) / delivered) : 0,
    };
  }

  /** Net revenue and delivered orders per calendar day in `tz`, for the dashboard chart. */
  async dailyNetRevenue(start: Date, end: Date, tz: string): Promise<Map<string, { revenueMinor: number; orders: number }>> {
    const revenueAccounts = [ACCOUNT.PRODUCT_SALES, ACCOUNT.DELIVERY_INCOME];
    const contraAccounts = [ACCOUNT.SALES_DISCOUNTS, ACCOUNT.SALES_RETURNS, ACCOUNT.DELIVERY_REFUNDS];
    const day = { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } };
    const pipeline: PipelineStage[] = [
      { $match: { date: { $gte: start, $lt: end } } },
      { $unwind: '$lines' },
      { $match: { 'lines.account': { $in: [...revenueAccounts, ...contraAccounts] } } },
      // Credits − debits nets it all: revenue accounts gain by credits, and the
      // contra accounts (discounts, returns) are debits that take it away.
      { $group: { _id: day, revenue: { $sum: { $subtract: ['$lines.creditMinor', '$lines.debitMinor'] } } } },
    ];
    const [revenue, orders] = await Promise.all([
      this.entryModel.aggregate<{ _id: string; revenue: number }>(pipeline).exec(),
      this.orderModel
        .aggregate<{ _id: string; orders: number }>([
          { $match: { bookedAt: { $gte: start, $lt: end } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookedAt', timezone: tz } }, orders: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const byDay = new Map<string, { revenueMinor: number; orders: number }>();
    for (const row of revenue) byDay.set(row._id, { revenueMinor: row.revenue, orders: 0 });
    for (const row of orders) byDay.set(row._id, { revenueMinor: byDay.get(row._id)?.revenueMinor ?? 0, orders: row.orders });
    return byDay;
  }
}
