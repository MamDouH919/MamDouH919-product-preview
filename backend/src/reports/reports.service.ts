import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReturnRequest, ReturnStatus } from '../returns/schemas/return-request.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Customer } from '../customers/schemas/customer.schema';
import { Review, ReviewStatus } from '../reviews/schemas/review.schema';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { FinanceReportsService, PeriodFigures } from '../finance/finance-reports.service';
import { toMajor } from '../finance/order-money';
import { dayKey, startOfDay, startOfNextDay } from '../common/helpers/time-zone';
import { STORE_MODULES } from '../common/tenant/tenant.module';
import { StoreModule } from '../common/tenant/store-plan';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Orders placed in a period: the pipeline. Not revenue — most aren't delivered yet. */
interface Pipeline {
  placed: number;
  placedValueMinor: number;
  cancelled: number;
}

export interface PeriodTotals {
  /** Net revenue: delivered in the period, net of discounts and refunds, delivery fees included. */
  revenue: number;
  revenueMinor: number;
  /** Orders delivered in the period. */
  orders: number;
  averageOrderValue: number;
  /** Orders placed in the period, whatever has happened to them since. */
  placed: number;
  /** Value of orders placed in the period and not cancelled. */
  placedValue: number;
  /** Orders placed in the period and since cancelled. */
  cancelled: number;
}

/** Amount of an order in minor units, for orders written before they carried one. */
const orderTotalMinor = { $ifNull: ['$totalMinor', { $round: [{ $multiply: ['$total', 100] }, 0] }] };

/** What the home page needs from a period's sales, from the books or, without them, the orders. */
type SalesFigures = Pick<PeriodFigures, 'netRevenueMinor' | 'deliveredOrders' | 'averageOrderValueMinor'>;

/** An order's revenue without the books: what it was sold for, delivery included, tax left out. */
const orderRevenueMinor = { $subtract: [orderTotalMinor, { $ifNull: ['$taxMinor', 0] }] };

function toTotals(figures: SalesFigures, pipeline: Pipeline): PeriodTotals {
  return {
    revenue: toMajor(figures.netRevenueMinor),
    revenueMinor: figures.netRevenueMinor,
    orders: figures.deliveredOrders,
    averageOrderValue: toMajor(figures.averageOrderValueMinor),
    placed: pipeline.placed,
    placedValue: toMajor(pipeline.placedValueMinor),
    cancelled: pipeline.cancelled,
  };
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    private readonly finance: FinanceReportsService,
    @Inject(STORE_MODULES) private readonly modules: readonly StoreModule[],
    @InjectModel(ReturnRequest.name) private returnModel: Model<ReturnRequest>,
  ) {}

  /**
   * Whether sales figures come from the books. A store without them counts
   * the orders it delivered instead, before any refunds: a store with stock but
   * no books records refunds on its cash-flow page, not here.
   */
  private get fromBooks(): boolean {
    return this.modules.includes(StoreModule.FINANCE);
  }

  /**
   * Everything the admin home page shows about sales, for the last `days`
   * days and the same span just before it. Revenue comes from the books: an
   * order counts on the day it was delivered, net of its discount, so pending
   * or cancelled orders never inflate it. Days are calendar days in the
   * store's own time zone, so every viewer sees the same figures.
   */
  async dashboard(query: DashboardQueryDto) {
    const days = Number(query.days ?? 30);
    const clock = await this.finance.storeClock();
    const tz = clock.timeZone;
    // The books starting late only matters to figures taken from them.
    const booksStartedAt = this.fromBooks ? clock.booksStartedAt : undefined;
    const now = new Date();

    const todayStart = startOfDay(now, tz);
    const end = startOfNextDay(now, tz);
    // Snap to midnight again after stepping back: a DST change inside the span
    // would otherwise leave the boundary an hour off.
    const periodStart = startOfDay(new Date(todayStart.getTime() - (days - 1) * DAY_MS + DAY_MS / 2), tz);
    const previousStart = startOfDay(new Date(periodStart.getTime() - days * DAY_MS + DAY_MS / 2), tz);

    const [
      current,
      previous,
      today,
      currentPipeline,
      previousPipeline,
      todayPipeline,
      daily,
      topProducts,
      statusRows,
      recentOrders,
      newCustomers,
      pendingReviews,
    ] = await Promise.all([
      this.sales(periodStart, end),
      this.sales(previousStart, periodStart),
      this.sales(todayStart, end),
      this.pipeline(periodStart, end),
      this.pipeline(previousStart, periodStart),
      this.pipeline(todayStart, end),
      this.fromBooks ? this.finance.dailyNetRevenue(periodStart, end, tz) : this.dailyDelivered(periodStart, end, tz),
      this.topProducts(periodStart, end),
      this.orderModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      this.orderModel
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select('orderNumber total currency status paymentStatus createdAt shippingAddress.fullName')
        .lean()
        .exec(),
      this.customerModel.countDocuments({ createdAt: { $gte: periodStart } }).exec(),
      this.reviewModel.countDocuments({ status: ReviewStatus.PENDING }).exec(),
    ]);

    // Every day in the span, including the quiet ones — a chart with gaps
    // would read a zero day as missing data.
    const series = Array.from({ length: days }, (_, i) => {
      const date = dayKey(new Date(periodStart.getTime() + i * DAY_MS + DAY_MS / 2), tz);
      const row = daily.get(date);
      return { date, revenue: toMajor(row?.revenueMinor ?? 0), orders: row?.orders ?? 0 };
    });

    const statusCounts = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const row of statusRows) statusCounts[row._id as OrderStatus] = row.count;

    return {
      days,
      timeZone: tz,
      periodStart,
      booksStartedAt,
      current: toTotals(current, currentPipeline),
      previous: toTotals(previous, previousPipeline),
      today: toTotals(today, todayPipeline),
      series,
      topProducts,
      statusCounts,
      recentOrders,
      newCustomers,
      pendingReviews,
    };
  }

  private async sales(start: Date, end: Date): Promise<SalesFigures> {
    if (this.fromBooks) return this.finance.period(start, end);
    const [row] = await this.orderModel
      .aggregate<{ revenue: number; orders: number }>([
        { $match: { status: OrderStatus.DELIVERED, deliveredAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, revenue: { $sum: orderRevenueMinor }, orders: { $sum: 1 } } },
      ])
      .exec();
    const revenue = row?.revenue ?? 0;
    const orders = row?.orders ?? 0;
    return {
      netRevenueMinor: revenue,
      deliveredOrders: orders,
      averageOrderValueMinor: orders ? Math.round(revenue / orders) : 0,
    };
  }

  /** Revenue and orders delivered per day in the store's zone, for a store without the books. */
  private async dailyDelivered(start: Date, end: Date, tz: string) {
    const rows = await this.orderModel
      .aggregate<{ _id: string; revenue: number; orders: number }>([
        { $match: { status: OrderStatus.DELIVERED, deliveredAt: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt', timezone: tz } },
            revenue: { $sum: orderRevenueMinor },
            orders: { $sum: 1 },
          },
        },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id, { revenueMinor: row.revenue, orders: row.orders }]));
  }

  /**
   * Plain money in and out for a store without books: what orders
   * brought in the day they were delivered, what settled returns gave back
   * the day they were settled, and the net. No accounts, no tax split.
   */
  async cashFlow(query: DashboardQueryDto) {
    if (this.fromBooks) throw new NotFoundException('Not found');
    const days = Number(query.days ?? 30);
    const { timeZone: tz } = await this.finance.storeClock();
    const now = new Date();
    const end = startOfNextDay(now, tz);
    const periodStart = startOfDay(new Date(startOfDay(now, tz).getTime() - (days - 1) * DAY_MS + DAY_MS / 2), tz);

    const inFilter = { status: OrderStatus.DELIVERED, deliveredAt: { $gte: periodStart, $lt: end } };
    const outFilter = { status: ReturnStatus.REFUNDED, settledAt: { $gte: periodStart, $lt: end }, refundAmount: { $gt: 0 } };

    const [inDaily, outDaily, orders, returns] = await Promise.all([
      this.orderModel
        .aggregate<{ _id: string; amount: number; count: number }>([
          { $match: inFilter },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt', timezone: tz } },
              amount: { $sum: orderTotalMinor },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.returnModel
        .aggregate<{ _id: string; amount: number; count: number }>([
          { $match: outFilter },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$settledAt', timezone: tz } },
              amount: { $sum: { $round: [{ $multiply: ['$refundAmount', 100] }, 0] } },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.orderModel.find(inFilter).sort({ deliveredAt: -1 }).limit(100).select('orderNumber total totalMinor deliveredAt').lean().exec(),
      this.returnModel.find(outFilter).sort({ settledAt: -1 }).limit(100).select('returnNumber orderNumber order refundAmount settledAt').lean().exec(),
    ]);

    const inByDay = new Map(inDaily.map((r) => [r._id, r]));
    const outByDay = new Map(outDaily.map((r) => [r._id, r]));
    const series = Array.from({ length: days }, (_, i) => {
      const date = dayKey(new Date(periodStart.getTime() + i * DAY_MS + DAY_MS / 2), tz);
      const moneyIn = inByDay.get(date)?.amount ?? 0;
      const moneyOut = outByDay.get(date)?.amount ?? 0;
      return { date, in: toMajor(moneyIn), out: toMajor(moneyOut), net: toMajor(moneyIn - moneyOut) };
    });
    const sum = (rows: { amount: number; count: number }[]) => ({
      amount: rows.reduce((t, r) => t + r.amount, 0),
      count: rows.reduce((t, r) => t + r.count, 0),
    });
    const totalIn = sum(inDaily);
    const totalOut = sum(outDaily);

    const entries = [
      ...orders.map((o) => ({
        type: 'in' as const,
        at: o.deliveredAt!,
        amount: o.totalMinor !== undefined ? toMajor(o.totalMinor) : o.total,
        orderId: String(o._id),
        orderNumber: o.orderNumber,
      })),
      ...returns.map((r) => ({
        type: 'out' as const,
        at: r.settledAt!,
        amount: r.refundAmount!,
        orderId: String(r.order),
        orderNumber: r.orderNumber,
        returnId: String(r._id),
        returnNumber: r.returnNumber,
      })),
    ]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, 100);

    return {
      days,
      timeZone: tz,
      periodStart,
      totals: {
        in: toMajor(totalIn.amount),
        out: toMajor(totalOut.amount),
        net: toMajor(totalIn.amount - totalOut.amount),
        orders: totalIn.count,
        returns: totalOut.count,
      },
      series,
      entries,
    };
  }

  private async pipeline(start: Date, end: Date): Promise<Pipeline> {
    const [row] = await this.orderModel
      .aggregate<Pipeline>([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: null,
            placed: { $sum: 1 },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] } },
            placedValueMinor: { $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 0, orderTotalMinor] } },
          },
        },
      ])
      .exec();
    return row ?? { placed: 0, placedValueMinor: 0, cancelled: 0 };
  }

  /** Best sellers among orders delivered in the period, by sales net of each line's share of the discount. */
  private async topProducts(start: Date, end: Date) {
    const rows = await this.orderModel
      .aggregate([
        {
          $match: this.fromBooks
            ? { bookedAt: { $gte: start, $lt: end } }
            : { status: OrderStatus.DELIVERED, deliveredAt: { $gte: start, $lt: end } },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            // Names and images come from the order snapshot, so a product
            // deleted since still shows what it was sold as.
            name: { $last: '$items.name' },
            image: { $last: '$items.image' },
            slug: { $last: '$items.slug' },
            quantity: { $sum: '$items.quantity' },
            revenueMinor: {
              $sum: {
                $subtract: [
                  { $ifNull: ['$items.lineTotalMinor', { $round: [{ $multiply: ['$items.lineTotal', 100] }, 0] }] },
                  { $ifNull: ['$items.discountMinor', 0] },
                ],
              },
            },
          },
        },
        { $sort: { revenueMinor: -1, quantity: -1 } },
        { $limit: 5 },
      ])
      .exec();
    return rows.map((row) => ({
      productId: row._id,
      name: row.name,
      image: row.image,
      slug: row.slug,
      quantity: row.quantity,
      revenue: toMajor(row.revenueMinor),
      revenueMinor: row.revenueMinor,
    }));
  }
}
