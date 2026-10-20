import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Customer } from '../customers/schemas/customer.schema';
import { Review, ReviewStatus } from '../reviews/schemas/review.schema';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { FinanceReportsService, PeriodFigures } from '../finance/finance-reports.service';
import { toMajor } from '../finance/order-money';
import { dayKey, startOfDay, startOfNextDay } from '../common/helpers/time-zone';

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

function toTotals(figures: PeriodFigures, pipeline: Pipeline): PeriodTotals {
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
  ) {}

  /**
   * Everything the admin home page shows about sales, for the last `days`
   * days and the same span just before it. Revenue comes from the books: an
   * order counts on the day it was delivered, net of its discount, so pending
   * or cancelled orders never inflate it. Days are calendar days in the
   * store's own time zone, so every viewer sees the same figures.
   */
  async dashboard(query: DashboardQueryDto) {
    const days = Number(query.days ?? 30);
    const { timeZone: tz, booksStartedAt } = await this.finance.storeClock();
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
      this.finance.period(periodStart, end),
      this.finance.period(previousStart, periodStart),
      this.finance.period(todayStart, end),
      this.pipeline(periodStart, end),
      this.pipeline(previousStart, periodStart),
      this.pipeline(todayStart, end),
      this.finance.dailyNetRevenue(periodStart, end, tz),
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
        { $match: { bookedAt: { $gte: start, $lt: end } } },
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
              $sum: { $subtract: ['$items.lineTotalMinor', { $ifNull: ['$items.discountMinor', 0] }] },
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
