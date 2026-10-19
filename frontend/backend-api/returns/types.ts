import { LocalizedField } from "../globalTypes";
import { OrderStatus } from "../orders/types";

export type ReturnStatus = "requested" | "approved" | "rejected" | "refunded";
export const RETURN_STATUSES: ReturnStatus[] = ["requested", "approved", "rejected", "refunded"];

export type ReturnReason = "damaged" | "wrong_item" | "not_as_described" | "changed_mind" | "other";
export const RETURN_REASONS: ReturnReason[] = ["damaged", "wrong_item", "not_as_described", "changed_mind", "other"];

export type ReturnItem = {
  lineIndex: number;
  product: string;
  variantId?: string;
  name: LocalizedField;
  variantLabel?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  restocked: boolean;
};

export type ReturnStatusChange = {
  status: ReturnStatus;
  note?: string;
  by?: { _id: string; name: string; email: string } | string;
  at: string;
};

export type ReturnRequest = {
  _id: string;
  returnNumber: number;
  order: string;
  orderNumber: number;
  customer: { _id: string; name: string; email: string; phone?: string } | string;
  items: ReturnItem[];
  reason: ReturnReason;
  note?: string;
  status: ReturnStatus;
  openedBy: "customer" | "store";
  refundAmount?: number;
  history: ReturnStatusChange[];
  createdAt: string;
};

export type ReturnDetail = ReturnRequest & {
  orderSummary?: {
    _id: string;
    orderNumber: number;
    status: OrderStatus;
    subtotal: number;
    discount?: number;
    shippingFee: number;
    total: number;
    refundedTotal?: number;
    currency?: LocalizedField;
  };
  /** What can still be refunded on the order. */
  refundableRemaining: number;
  /** Line prices less the order's discount share, capped at what's left. */
  suggestedRefund: number;
};

export type ReturnableLine = {
  lineIndex: number;
  name: LocalizedField;
  variantLabel?: string;
  image?: string;
  unitPrice: number;
  purchased: number;
  returnable: number;
};

/** The customer's order page: can they ask, until when, and what's already open. */
export type CustomerReturnView = {
  eligible: boolean;
  windowDays: number;
  deadline: string | null;
  lines: ReturnableLine[];
  requests: ReturnRequest[];
};

export type CreateReturnPayload = {
  orderId: string;
  items: { lineIndex: number; quantity: number }[];
  reason: ReturnReason;
  note?: string;
};

export type ReturnFilters = { status?: ReturnStatus; search?: string; page?: number; limit?: number };

export type ReturnsResponse = {
  data: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<ReturnStatus, number>;
};
