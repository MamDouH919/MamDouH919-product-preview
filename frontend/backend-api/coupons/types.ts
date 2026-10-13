export type CouponType = "percentage" | "fixed";

export type Coupon = {
  _id: string;
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minSubtotal?: number | null;
  maxDiscount?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
};

/** Optional limits are sent as null to clear them on edit. */
export type CouponPayload = {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minSubtotal?: number | null;
  maxDiscount?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isActive: boolean;
};

/** Why a coupon was refused — mirrors CouponError on the server. */
export type CouponErrorCode =
  | "not_found"
  | "not_started"
  | "expired"
  | "usage_limit"
  | "customer_limit"
  | "min_subtotal";
