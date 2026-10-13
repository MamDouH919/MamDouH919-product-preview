import { LocalizedField } from "../globalTypes";
import { CouponErrorCode, CouponType } from "../coupons/types";

export type AppliedCoupon = { code: string; type: CouponType; value: number };

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

/** Mirrors ORDER_TRANSITIONS on the server — which buttons an admin is offered. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export type PaymentMethod = "cash_on_delivery";

export type OrderItemInput = {
  productId: string;
  variantId?: string;
  quantity: number;
};

export type QuoteIssue = "unavailable" | "no_price" | "insufficient_stock";

export type QuoteLine = {
  productId: string;
  variantId?: string;
  name?: LocalizedField;
  variantLabel?: string;
  sku?: string;
  image?: string;
  slug?: string;
  unitPrice?: number;
  quantity: number;
  lineTotal: number;
  available: number | null;
  issue?: QuoteIssue;
};

export type Quote = {
  items: QuoteLine[];
  subtotal: number;
  discount: number;
  coupon?: AppliedCoupon;
  /** Why the requested coupon doesn't apply; the rest of the quote still stands. */
  couponError?: { code: CouponErrorCode; minSubtotal?: number };
  shippingFee: number;
  total: number;
  currency?: LocalizedField;
  valid: boolean;
};

export type OrderItem = {
  product: string;
  variantId?: string;
  name: LocalizedField;
  variantLabel?: string;
  sku?: string;
  image?: string;
  slug?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ShippingAddress = {
  fullName: string;
  phone: string;
  city: string;
  area?: string;
  street: string;
  building?: string;
  notes?: string;
};

export type OrderStatusChange = {
  status: OrderStatus;
  note?: string;
  by?: { _id: string; name: string; email: string } | string;
  at: string;
};

export type Order = {
  _id: string;
  orderNumber: number;
  customer: { _id: string; name: string; email: string; phone?: string } | string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  subtotal: number;
  discount?: number;
  coupon?: AppliedCoupon;
  shippingFee: number;
  total: number;
  currency?: LocalizedField;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  statusHistory?: OrderStatusChange[];
  notes?: string;
  createdAt: string;
};

export type OrdersResponse = {
  data: Order[];
  total: number;
  page: number;
  limit: number;
};

export type OrderFilters = {
  status?: OrderStatus;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type CreateOrderPayload = {
  items: OrderItemInput[];
  addressId: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  couponCode?: string;
  /** Language the order emails are written in. */
  locale?: string;
};
