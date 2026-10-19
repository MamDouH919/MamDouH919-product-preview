import { LocalizedField } from "../globalTypes";
import { OrderStatus } from "../orders/types";

export type DashboardPeriod = 7 | 30 | 90;

export type PeriodTotals = {
  /** Sum of order totals, cancelled orders excluded. */
  revenue: number;
  orders: number;
  averageOrderValue: number;
  cancelled: number;
};

export type DashboardReport = {
  days: DashboardPeriod;
  timeZone: string;
  periodStart: string;
  current: PeriodTotals;
  /** The same number of days just before the current span, for comparison. */
  previous: PeriodTotals;
  today: PeriodTotals;
  /** One row per calendar day in the span, oldest first, zero days included. */
  series: { date: string; revenue: number; orders: number }[];
  topProducts: {
    productId: string;
    name: LocalizedField;
    image?: string;
    slug?: string;
    quantity: number;
    revenue: number;
  }[];
  /** All-time order count per status. */
  statusCounts: Record<OrderStatus, number>;
  recentOrders: {
    _id: string;
    orderNumber: number;
    total: number;
    currency?: LocalizedField;
    status: OrderStatus;
    createdAt: string;
    shippingAddress: { fullName: string };
  }[];
  newCustomers: number;
  pendingReviews: number;
};
