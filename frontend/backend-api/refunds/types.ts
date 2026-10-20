export type RefundStatus = "requested" | "approved" | "rejected" | "executed" | "reversed";
export const REFUND_STATUSES: RefundStatus[] = ["requested", "approved", "executed", "rejected", "reversed"];

/** How the money goes back. */
export type RefundMethod = "cash" | "courier_cash" | "credit_against_receivable";
export const REFUND_METHODS: RefundMethod[] = ["cash", "courier_cash", "credit_against_receivable"];

export type RefundReason =
  | "damaged"
  | "wrong_item"
  | "not_as_described"
  | "changed_mind"
  | "late_delivery"
  | "goodwill"
  | "other";
export const REFUND_REASONS: RefundReason[] = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "late_delivery",
  "goodwill",
  "other",
];

export type DeliveryFeeRefundPolicy = "never" | "store_fault_full_return" | "full_return" | "manual";

/** Amounts are minor units (piastres) throughout. */
export type Refund = {
  _id: string;
  refundNumber: number;
  order: string;
  orderNumber: number;
  customer: { _id: string; name: string; email: string } | string;
  returnRequest?: string;
  returnNumber?: number;
  lines: { lineIndex: number; quantity: number; amountMinor: number; restock: boolean; restocked: boolean }[];
  productMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  method: RefundMethod;
  reason: RefundReason;
  note?: string;
  status: RefundStatus;
  autoApproved: boolean;
  beyondPolicy: boolean;
  requestedBy?: { _id: string; name: string } | string;
  approvedBy?: { _id: string; name: string } | string;
  executedBy?: { _id: string; name: string } | string;
  executedAt?: string;
  history: { status: RefundStatus; by?: { name: string } | string; at: string; note?: string }[];
  createdAt: string;
};

export type RefundsResponse = {
  data: Refund[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<RefundStatus, number>;
};

export type RefundFilters = { status?: RefundStatus; orderId?: string; returnId?: string; page?: number; limit?: number };

export type RefundRules = {
  autoApproveUpToMinor: number;
  singleApproverUpToMinor: number;
  deliveryFeeRefund: DeliveryFeeRefundPolicy;
  history?: { field: string; from: unknown; to: unknown; at: string }[];
};

export type RefundBasis = {
  orderId: string;
  returnId?: string;
  lines?: { lineIndex: number; quantity: number; restock?: boolean }[];
  reason: RefundReason;
};

export type RefundPreview = {
  rules: RefundRules;
  lines: {
    lineIndex: number;
    quantity: number;
    purchased: number;
    remainingQty: number;
    remainingMinor: number;
    suggestedMinor: number;
    restockable: boolean;
  }[];
  productSuggestedMinor: number;
  productMaxMinor: number;
  deliverySuggestedMinor: number;
  deliveryMaxMinor: number;
  fullReturn: boolean;
  totalRemainingMinor: number;
  cashRemainingMinor: number;
  creditRemainingMinor: number;
};

export type CreateRefundPayload = RefundBasis & {
  /** Decimal strings, so no float ever carries money. Left out → the suggested amounts. */
  productAmount?: string;
  deliveryAmount?: string;
  method: RefundMethod;
  /** The courier who pays it — required for `courier_cash`. */
  courierId?: string;
  /** For `cash`: paid from which account; the default when left out. */
  moneyAccountId?: string;
  note?: string;
};
