import { mulDiv } from '../common/money/money';
import { DeliveryFeeRefundPolicy, FinanceSettings } from '../settings/schemas/setting.schema';
import { OrderAmounts, outstandingOf, MoneyState } from '../finance/order-money';
import { RefundMethod, RefundReason, STORE_FAULT_REASONS } from './schemas/refund.schema';

/** The store's refund rules, with the defaults the specification proposes (section 7). */
export interface RefundRules {
  autoApproveUpToMinor: number;
  singleApproverUpToMinor: number;
  deliveryFeeRefund: DeliveryFeeRefundPolicy;
}

export const DEFAULT_REFUND_RULES: RefundRules = {
  autoApproveUpToMinor: 20_000, // 200.00
  singleApproverUpToMinor: 200_000, // 2,000.00
  deliveryFeeRefund: DeliveryFeeRefundPolicy.STORE_FAULT_FULL_RETURN,
};

export function refundRules(finance?: Partial<FinanceSettings>): RefundRules {
  return {
    autoApproveUpToMinor: finance?.refundAutoApproveUpToMinor ?? DEFAULT_REFUND_RULES.autoApproveUpToMinor,
    singleApproverUpToMinor: finance?.refundSingleApproverUpToMinor ?? DEFAULT_REFUND_RULES.singleApproverUpToMinor,
    deliveryFeeRefund: finance?.deliveryFeeRefund ?? DEFAULT_REFUND_RULES.deliveryFeeRefund,
  };
}

/** The parts of a refund that count against what an order can still give back. */
export interface CountedRefund {
  lines: { lineIndex: number; quantity: number; amountMinor: number }[];
  deliveryMinor: number;
  totalMinor: number;
  method: RefundMethod;
}

export interface LineCapacity {
  lineIndex: number;
  purchased: number;
  /** The line's total less its share of the order discount — what the customer paid for it. */
  netMinor: number;
  remainingQty: number;
  remainingMinor: number;
}

/** What an order can still give back, after the refunds passed in. */
export interface Capacity {
  lines: LineCapacity[];
  deliveryRemainingMinor: number;
  totalRemainingMinor: number;
  /** Cash can only go back once it came in: collected less cash already refunded. */
  cashRemainingMinor: number;
  /** A credit can only cancel what is still owed. */
  creditRemainingMinor: number;
}

export const isCashMethod = (method: RefundMethod) =>
  method === RefundMethod.CASH || method === RefundMethod.COURIER_CASH;

/**
 * The four caps of the specification, worked out from the order's amounts,
 * what was collected, and the refunds that count — executed ones when paying
 * out, executed and still-open ones when a new refund is asked for.
 */
export function capacity(amounts: OrderAmounts, money: MoneyState, refunds: CountedRefund[]): Capacity {
  const lines = amounts.lines.map((line, lineIndex) => {
    const netMinor = line.lineTotalMinor - line.discountMinor;
    let qty = 0;
    let minor = 0;
    for (const r of refunds) {
      for (const l of r.lines) {
        if (l.lineIndex !== lineIndex) continue;
        qty += l.quantity;
        minor += l.amountMinor;
      }
    }
    return { lineIndex, purchased: line.quantity, netMinor, remainingQty: line.quantity - qty, remainingMinor: netMinor - minor };
  });

  const sum = (pick: (r: CountedRefund) => number, only?: (r: CountedRefund) => boolean) =>
    refunds.filter((r) => !only || only(r)).reduce((total, r) => total + pick(r), 0);

  return {
    lines,
    deliveryRemainingMinor: amounts.shippingFeeMinor - sum((r) => r.deliveryMinor),
    totalRemainingMinor: amounts.totalMinor - sum((r) => r.totalMinor),
    cashRemainingMinor: (money.collectedMinor ?? 0) - sum((r) => r.totalMinor, (r) => isCashMethod(r.method)),
    creditRemainingMinor:
      outstandingOf(amounts.totalMinor, { collectedMinor: money.collectedMinor, writtenOffMinor: money.writtenOffMinor }) -
      sum((r) => r.totalMinor, (r) => r.method === RefundMethod.CREDIT_AGAINST_RECEIVABLE),
  };
}

/**
 * What giving back `quantity` units of a line is worth: their share of what
 * was paid for the line (rounded half up), and for the last units back
 * exactly what remains — so a line refunded in parts adds up to its net.
 */
export function suggestedLineMinor(line: LineCapacity, quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity >= line.remainingQty) return line.remainingMinor;
  return Math.min(line.remainingMinor, mulDiv(line.netMinor, quantity, line.purchased));
}

/** Whether, after this refund, every unit of every line will have come back. */
export function isFullReturn(cap: Capacity, requested: { lineIndex: number; quantity: number }[]): boolean {
  return cap.lines.every((line) => {
    const asked = requested.filter((r) => r.lineIndex === line.lineIndex).reduce((t, r) => t + r.quantity, 0);
    return line.remainingQty - asked <= 0;
  });
}

/** How much of the delivery fee the store's policy gives back with this refund. */
export function allowedDeliveryMinor(
  policy: DeliveryFeeRefundPolicy,
  fullReturn: boolean,
  reason: RefundReason,
  deliveryRemainingMinor: number,
): number {
  switch (policy) {
    case DeliveryFeeRefundPolicy.NEVER:
      return 0;
    case DeliveryFeeRefundPolicy.STORE_FAULT_FULL_RETURN:
      return fullReturn && STORE_FAULT_REASONS.includes(reason) ? deliveryRemainingMinor : 0;
    case DeliveryFeeRefundPolicy.FULL_RETURN:
      return fullReturn ? deliveryRemainingMinor : 0;
    case DeliveryFeeRefundPolicy.MANUAL:
      return deliveryRemainingMinor;
  }
}

/** Approved on request: small enough, and nothing beyond the delivery-fee policy. */
export function autoApproves(rules: RefundRules, totalMinor: number, beyondPolicy: boolean): boolean {
  return !beyondPolicy && totalMinor <= rules.autoApproveUpToMinor;
}

/** Above the single-approver limit, whoever asked can't also approve. */
export function needsSecondPerson(rules: RefundRules, totalMinor: number): boolean {
  return totalMinor > rules.singleApproverUpToMinor;
}
