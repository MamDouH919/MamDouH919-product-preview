export enum OrderStatus {
  /** Placed by the customer, stock already reserved, not yet looked at. */
  PENDING = 'pending',
  /** The store accepted it and is preparing it. */
  CONFIRMED = 'confirmed',
  /** Handed to delivery. */
  SHIPPED = 'shipped',
  /** Reached the customer. Final. */
  DELIVERED = 'delivered',
  /** Called off before delivery; its stock went back on the shelf. Final. */
  CANCELLED = 'cancelled',
}

/**
 * Where an order may go from each status. Anything not listed is refused, so an
 * order can never skip from pending to delivered or come back from cancelled —
 * and cancelling (which restocks) can only happen once.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash_on_delivery',
}

/**
 * What the customer has paid, kept apart from `OrderStatus`: a delivered
 * order is not a paid one until the money is recorded.
 */
export enum OrderPaymentStatus {
  /** Nothing collected yet (every order starts here). */
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  /** Some of the order's money has been given back. */
  PARTIALLY_REFUNDED = 'partially_refunded',
  /** All of it has. */
  REFUNDED = 'refunded',
  /** What was left unpaid was written off as uncollectible. */
  WRITTEN_OFF = 'written_off',
  /** Delivered before this store's books started — history, outside the books. */
  NOT_TRACKED = 'not_tracked',
}
