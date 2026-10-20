export enum MovementType {
  /** Stock the product was created with. */
  OPENING = 'opening',
  /** Goods received from a supplier. */
  PURCHASE = 'purchase',
  /** Sold through an order. */
  SALE = 'sale',
  /** Customer sent it back. */
  RETURN = 'return',
  /** Broken, expired or written off. */
  DAMAGE = 'damage',
  /** Stock returned to shelf because an order was cancelled. */
  ORDER_CANCELLED = 'order_cancelled',
  /** Manual correction that adds stock — a stock take found more than recorded. */
  ADJUSTMENT_IN = 'adjustment_in',
  /** Manual correction that removes stock — a stock take found less than recorded. */
  ADJUSTMENT_OUT = 'adjustment_out',
  /** Goods sent back to the supplier they were bought from. */
  PURCHASE_RETURN = 'purchase_return',
  /** Stock on hand given its first cost. Moves no units, only value. */
  COST_SET = 'cost_set',
}

/**
 * Which way each movement type pushes stock. Every type commits to a direction,
 * so a caller only ever sends a positive quantity and the type decides the sign.
 */
export const MOVEMENT_DIRECTION: Record<MovementType, 1 | -1> = {
  [MovementType.OPENING]: 1,
  [MovementType.PURCHASE]: 1,
  [MovementType.RETURN]: 1,
  [MovementType.ORDER_CANCELLED]: 1,
  [MovementType.ADJUSTMENT_IN]: 1,
  [MovementType.SALE]: -1,
  [MovementType.DAMAGE]: -1,
  [MovementType.ADJUSTMENT_OUT]: -1,
  [MovementType.PURCHASE_RETURN]: -1,
  [MovementType.COST_SET]: 1,
};

/**
 * Types an admin may pick by hand. The rest are written by the system — orders
 * record sales and cancellations, purchases record goods received, refunds
 * record goods coming back — because each of those also moves money, and a
 * hand-typed one would put stock on the shelf with no cost or supplier behind it.
 */
export const MANUAL_MOVEMENT_TYPES: MovementType[] = [
  MovementType.DAMAGE,
  MovementType.ADJUSTMENT_IN,
  MovementType.ADJUSTMENT_OUT,
];

/** What a client needs to render a type without hardcoding any of these rules. */
export interface MovementTypeInfo {
  type: MovementType;
  direction: 1 | -1;
  manual: boolean;
}

export const MOVEMENT_TYPE_INFO: MovementTypeInfo[] = Object.values(MovementType).map(
  (type) => ({
    type,
    direction: MOVEMENT_DIRECTION[type],
    manual: MANUAL_MOVEMENT_TYPES.includes(type),
  }),
);
