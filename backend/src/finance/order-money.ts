import { allocate, formatMinor, MoneyError, parseMoney } from '../common/money/money';
import { OrderPaymentStatus } from '../orders/enums/order-status.enum';

/** A priced line in minor units. */
export interface MinorLine {
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  /** The line's share of the order discount. */
  discountMinor: number;
}

export interface OrderAmounts {
  subtotalMinor: number;
  discountMinor: number;
  shippingFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  lines: MinorLine[];
}

/** Minor units as pounds, for the fields screens and emails already read (31500 → 315). */
export const toMajor = (minor: number): number => Number(formatMinor(minor));

/** A stored price in pounds as minor units. Prices are validated to whole piastres, so this is exact. */
export const priceToMinor = (price: number): number => parseMoney(price);

/**
 * Lines priced, the discount split across them by value (largest remainder,
 * so the shares add up to the discount exactly), and the order's totals.
 */
export function priceOrder(
  lines: { unitPriceMinor: number; quantity: number }[],
  discountMinor: number,
  shippingFeeMinor: number,
  taxMinor = 0,
): OrderAmounts {
  const totals = lines.map((l) => l.unitPriceMinor * l.quantity);
  const subtotalMinor = totals.reduce((a, b) => a + b, 0);
  if (discountMinor > subtotalMinor) throw new MoneyError('A discount cannot exceed the subtotal');
  const shares = subtotalMinor > 0 ? allocate(discountMinor, totals) : lines.map(() => 0);

  return {
    subtotalMinor,
    discountMinor,
    shippingFeeMinor,
    taxMinor,
    totalMinor: subtotalMinor - discountMinor + shippingFeeMinor + taxMinor,
    lines: lines.map((l, i) => ({
      unitPriceMinor: l.unitPriceMinor,
      quantity: l.quantity,
      lineTotalMinor: totals[i],
      discountMinor: shares[i],
    })),
  };
}

/** The money fields of an order, as stored — old orders may carry pounds only. */
export interface StoredOrderMoney {
  subtotal: number;
  discount?: number;
  shippingFee?: number;
  total: number;
  subtotalMinor?: number;
  discountMinor?: number;
  shippingFeeMinor?: number;
  taxMinor?: number;
  totalMinor?: number;
  items: { unitPrice: number; quantity: number; lineTotal: number; unitPriceMinor?: number; lineTotalMinor?: number; discountMinor?: number }[];
}

/**
 * An order's amounts in minor units. Orders written before the books carry
 * pounds only; those are converted (exact, since every stored amount is whole
 * piastres) and re-checked, so a figure that doesn't add up is refused rather
 * than booked.
 */
export function orderAmounts(order: StoredOrderMoney): OrderAmounts {
  const hasMinor = order.totalMinor !== undefined && order.items.every((i) => i.unitPriceMinor !== undefined);
  const amounts = hasMinor
    ? {
        subtotalMinor: order.subtotalMinor!,
        discountMinor: order.discountMinor ?? 0,
        shippingFeeMinor: order.shippingFeeMinor ?? 0,
        taxMinor: order.taxMinor ?? 0,
        totalMinor: order.totalMinor!,
        lines: order.items.map((i) => ({
          unitPriceMinor: i.unitPriceMinor!,
          quantity: i.quantity,
          lineTotalMinor: i.lineTotalMinor ?? i.unitPriceMinor! * i.quantity,
          discountMinor: i.discountMinor ?? 0,
        })),
      }
    : priceOrder(
        order.items.map((i) => ({ unitPriceMinor: parseMoney(i.unitPrice), quantity: i.quantity })),
        parseMoney(order.discount ?? 0),
        parseMoney(order.shippingFee ?? 0),
      );

  const problems = amountProblems(amounts);
  if (!hasMinor) {
    if (amounts.subtotalMinor !== parseMoney(order.subtotal)) problems.push('subtotal');
    if (amounts.totalMinor !== parseMoney(order.total)) problems.push('total');
  }
  if (problems.length) throw new MoneyError(`Order amounts don't add up (${problems.join(', ')})`);
  return amounts;
}

/** Which of an order's sums don't hold — empty when everything adds up. */
export function amountProblems(a: OrderAmounts): string[] {
  const problems: string[] = [];
  if (a.lines.some((l) => l.lineTotalMinor !== l.unitPriceMinor * l.quantity)) problems.push('line totals');
  if (a.lines.reduce((s, l) => s + l.lineTotalMinor, 0) !== a.subtotalMinor) problems.push('subtotal');
  if (a.lines.reduce((s, l) => s + l.discountMinor, 0) !== a.discountMinor) problems.push('discount split');
  if (a.subtotalMinor - a.discountMinor + a.shippingFeeMinor + a.taxMinor !== a.totalMinor) problems.push('total');
  return problems;
}

/** What has happened to an order's money (its `money` subdocument). */
export interface MoneyState {
  collectedMinor?: number;
  refundedMinor?: number;
  creditedMinor?: number;
  writtenOffMinor?: number;
}

/**
 * An order's money as plain numbers. `order.money` is a Mongoose subdocument,
 * and spreading one (`{ ...order.money }`) copies none of its fields — so
 * anything recomputed from a copy must start here.
 */
export function moneyOf(order: { money?: MoneyState }): Required<MoneyState> {
  const m = order.money;
  return {
    collectedMinor: m?.collectedMinor ?? 0,
    refundedMinor: m?.refundedMinor ?? 0,
    creditedMinor: m?.creditedMinor ?? 0,
    writtenOffMinor: m?.writtenOffMinor ?? 0,
  };
}

/**
 * What the customer still owes on a booked order: the total, less what was
 * collected, what refunds took off the balance instead of paying out, and
 * what was written off as uncollectible.
 */
export function outstandingOf(totalMinor: number, money: MoneyState = {}): number {
  return totalMinor - (money.collectedMinor ?? 0) - (money.creditedMinor ?? 0) - (money.writtenOffMinor ?? 0);
}

/**
 * Payment status from the order's money. A refund says more than how it was
 * paid, so it wins; otherwise it is how much of the total is settled.
 */
export function paymentStatusFor(totalMinor: number, money: MoneyState = {}): OrderPaymentStatus {
  const refunded = money.refundedMinor ?? 0;
  if (refunded > 0) return refunded >= totalMinor ? OrderPaymentStatus.REFUNDED : OrderPaymentStatus.PARTIALLY_REFUNDED;
  if (outstandingOf(totalMinor, money) <= 0) {
    return (money.writtenOffMinor ?? 0) > 0 ? OrderPaymentStatus.WRITTEN_OFF : OrderPaymentStatus.PAID;
  }
  return (money.collectedMinor ?? 0) > 0 ? OrderPaymentStatus.PARTIALLY_PAID : OrderPaymentStatus.UNPAID;
}
