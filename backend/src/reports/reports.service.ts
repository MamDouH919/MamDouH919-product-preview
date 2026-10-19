import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Customer } from '../customers/schemas/customer.schema';
import { Review, ReviewStatus } from '../reviews/schemas/review.schema';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodTotals {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  cancelled: number;
}

const EMPTY_TOTALS: PeriodTotals = { revenue: 0, orders: 0, averageOrderValue: 0, cancelled: 0 };

/** Falls back to UTC for anything `Intl` doesn't recognise, rather than failing the page. */
function safeTimeZone(tz?: string): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** `YYYY-MM-DD` of an instant as seen in `tz` — the same key Mongo's `$dateToString` produces. */
function dayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** The instant local midnight began in `tz` on the day containing `date`. */
function startOfDay(date: Date, tz: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  );
  // How far `tz` is ahead of UTC at this instant.
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = asUtc - Math.floor(date.getTime() / 1000) * 1000;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offset);
}

const notCancelled = { $ne: ['$status', OrderStatus.CANCELLED] };

/** `$group` fields shared by every totals bucket. Cancelled orders count separately, never as sales. */
/** What the store kept: the order total less anything refunded through returns. */
const netTotal = { $subtract: ['$total', { $ifNull: ['$refundedTotal', 0] }] };

const totalsGroup = {
  revenue: { $sum: { $cond: [notCancelled, netTotal, 0] } },
  orders: { $sum: { $cond: [notCancelled, 1, 0] } },
  cancelled: { $sum: { $cond: [notCancelled, 0, 1] } },
};

function toTotals(row?: { revenue: number; orders: number; cancelled: number }): PeriodTotals {
  if (!row) return { ...EMPTY_TOTALS };
  return {
    revenue: row.revenue,
    orders: row.orders,
    cancelled: row.cancelled,
    averageOrderValue: row.orders ? row.revenue / row.orders : 0,
  };
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Review.name) private reviewModel: Model<Review>,
  ) {}

  /**
   * Everything the admin home page shows about sales, for the last `days`
   * days and the same span just before it. A day is a calendar day in the
   * viewer's time zone, so "today" means the same thing to the store owner as
   * it does on their clock.
   */
  async dashboard(query: DashboardQueryDto) {
    const days = Number(query.days ?? 30);
    const tz = safeTimeZone(query.tz);
    const now = new Date();

    const todayStart = startOfDay(now, tz);
    // Snap to midnight again after stepping back: a DST change inside the span
    // would otherwise leave the boundary an hour off.
    const periodStart = startOfDay(new Date(todayStart.getTime() - (days - 1) * DAY_MS + DAY_MS / 2), tz);
    const previousStart = startOfDay(new Date(periodStart.getTime() - days * DAY_MS + DAY_MS / 2), tz);

    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: previousStart } } },
      {
        $facet: {
          periods: [
            {
              $group: {
                _id: { $cond: [{ $gte: ['$createdAt', periodStart] }, 'current', 'previous'] },
                ...totalsGroup,
              },
            },
          ],
          today: [
            { $match: { createdAt: { $gte: todayStart } } },
            { $group: { _id: null, ...totalsGroup } },
          ],
          daily: [
            { $match: { createdAt: { $gte: periodStart }, status: { $ne: OrderStatus.CANCELLED } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
                revenue: { $sum: netTotal },
                orders: { $sum: 1 },
              },
            },
          ],
          topProducts: [
            { $match: { createdAt: { $gte: periodStart }, status: { $ne: OrderStatus.CANCELLED } } },
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
                revenue: { $sum: '$items.lineTotal' },
              },
            },
            { $sort: { revenue: -1, quantity: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ];

    const [[facets], statusRows, recentOrders, newCustomers, pendingReviews] = await Promise.all([
      this.orderModel.aggregate(pipeline).exec(),
      this.orderModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      this.orderModel
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select('orderNumber total currency status createdAt shippingAddress.fullName')
        .lean()
        .exec(),
      this.customerModel.countDocuments({ createdAt: { $gte: periodStart } }).exec(),
      this.reviewModel.countDocuments({ status: ReviewStatus.PENDING }).exec(),
    ]);

    const byPeriod = new Map<string, any>(facets.periods.map((row: any) => [row._id, row]));
    const byDay = new Map<string, { revenue: number; orders: number }>(
      facets.daily.map((row: any) => [row._id, row]),
    );

    // Every day in the span, including the quiet ones — a chart with gaps
    // would read a zero day as missing data.
    const series = Array.from({ length: days }, (_, i) => {
      const date = dayKey(new Date(periodStart.getTime() + i * DAY_MS + DAY_MS / 2), tz);
      const row = byDay.get(date);
      return { date, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 };
    });

    const statusCounts = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const row of statusRows) statusCounts[row._id as OrderStatus] = row.count;

    return {
      days,
      timeZone: tz,
      periodStart,
      current: toTotals(byPeriod.get('current')),
      previous: toTotals(byPeriod.get('previous')),
      today: toTotals(facets.today[0]),
      series,
      topProducts: facets.topProducts.map((row: any) => ({
        productId: row._id,
        name: row.name,
        image: row.image,
        slug: row.slug,
        quantity: row.quantity,
        revenue: row.revenue,
      })),
      statusCounts,
      recentOrders,
      newCustomers,
      pendingReviews,
    };
  }
}
