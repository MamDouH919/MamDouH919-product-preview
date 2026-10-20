import { LocalizedField } from "../globalTypes";
import { OrderStatus } from "../orders/types";

export type DashboardPeriod = 7 | 30 | 90;

export type PeriodTotals = {
  /**
   * Net revenue from the books: orders delivered in the period, net of
   * discounts and refunds, delivery fees included. Never an order total.
   */
  revenue: number;
  revenueMinor: number;
  /** Orders delivered in the period. */
  orders: number;
  averageOrderValue: number;
  /** Orders placed in the period — the pipeline, not revenue. */
  placed: number;
  /** Value of orders placed in the period and not cancelled. */
  placedValue: number;
  /** Orders placed in the period and since cancelled. */
  cancelled: number;
};

export type DashboardReport = {
  days: DashboardPeriod;
  /** The store's own zone — days start at its midnight for every viewer. */
  timeZone: string;
  periodStart: string;
  /** When this store's books began; sales delivered before it aren't counted. */
  booksStartedAt?: string;
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
