import { mulDiv } from '../common/money/money';

/**
 * Moving weighted-average costing (finance specification, section 8), as
 * pure arithmetic on one product's or variant's stock. All amounts are minor
 * units.
 *
 * A pool holds a quantity and the total value of that quantity. Issuing q of
 * Q units costs round_half_up(value × q ÷ Q), and issuing the last units
 * costs exactly what is left — so value always drains to 0 with the stock and
 * no rounding drift can build up (example E2).
 *
 * A pool is *unvalued* (`valueMinor === null`) until its cost is known: stock
 * from before the books, never priced. Its sales carry no cost and are
 * reported as uncosted rather than guessed at.
 *
 * Selling into negative stock (backorders) costs the missing units at the
 * last known unit cost and marks them estimated. When stock arrives, the
 * difference between that estimate and the true cost of the units that cover
 * the shortfall is the *variance*, which belongs in cost of goods sold.
 */
export interface Pool {
  qty: number;
  valueMinor: number | null;
  /** Cost of one unit at the last receipt — the estimate for units sold short. */
  lastUnitCostMinor: number | null;
}

export interface Issued {
  /** Cost of the units issued; null when the pool is unvalued. */
  costMinor: number | null;
  /** Some of the units were sold short and costed at the last unit cost. */
  estimated: boolean;
  next: Pool;
}

export interface Received {
  /**
   * True cost of the short units this receipt covers, less what they were
   * estimated at when sold. Positive: cost of goods sold was understated.
   */
  varianceMinor: number;
  next: Pool;
}

export const isValued = (pool: Pool): boolean => pool.valueMinor !== null;

/** What one unit is worth right now — the average, or the last receipt when nothing is on hand. */
export function unitCost(pool: Pool): number | null {
  if (pool.valueMinor === null) return null;
  if (pool.qty > 0) return mulDiv(pool.valueMinor, 1, pool.qty);
  return pool.lastUnitCostMinor;
}

/** Takes `q` units out at average cost. */
export function issue(pool: Pool, q: number): Issued {
  if (pool.valueMinor === null) {
    return { costMinor: null, estimated: false, next: { ...pool, qty: pool.qty - q } };
  }
  const { qty, valueMinor } = pool;

  let cost: number;
  let estimated = false;
  if (qty >= q && qty > 0) {
    cost = q === qty ? valueMinor : mulDiv(valueMinor, q, qty);
  } else {
    // Everything on hand goes at its value; the rest is sold short.
    const fromStock = Math.max(qty, 0);
    const short = q - fromStock;
    cost = (fromStock > 0 ? valueMinor : 0) + short * (pool.lastUnitCostMinor ?? 0);
    estimated = short > 0;
  }
  return { costMinor: cost, estimated, next: { ...pool, qty: qty - q, valueMinor: valueMinor - cost } };
}

/**
 * Takes `q` units out at a stated cost rather than the average — goods sent
 * back to the supplier leave at what they were bought for. If that empties the
 * pool, whatever value is left over is variance, so the pool reads exactly 0.
 */
export function issueAt(pool: Pool, q: number, costMinor: number): Received {
  if (pool.valueMinor === null) return { varianceMinor: 0, next: { ...pool, qty: pool.qty - q } };
  const qty = pool.qty - q;
  let value = pool.valueMinor - costMinor;
  let varianceMinor = 0;
  if (qty === 0 && value !== 0) {
    varianceMinor = value;
    value = 0;
  }
  return { varianceMinor, next: { ...pool, qty, valueMinor: value } };
}

/**
 * Puts `q` units in at a known total cost: a purchase, opening stock with a
 * cost, or goods coming back at what they were sold out at. Units that cover
 * a shortfall settle its estimate; the difference is the variance.
 */
export function receive(pool: Pool, q: number, valueMinor: number): Received {
  if (q <= 0) throw new Error('receive takes a positive quantity');
  const lastUnitCostMinor = mulDiv(valueMinor, 1, q);

  // An unvalued pool with stock on hand can't take a cost: what is on the
  // shelf has none, and averaging it in would make one up. A pool with
  // nothing on hand starts being valued here; units it sold short had no
  // cost at all, so their whole true cost is variance.
  if (pool.valueMinor === null && pool.qty > 0) {
    throw new UnvaluedStockError(pool.qty);
  }
  const value = pool.valueMinor ?? 0;
  const qty = pool.qty;

  let varianceMinor = 0;
  if (qty < 0) {
    const covered = Math.min(q, -qty);
    const estimatedCovered = covered === -qty ? -value : mulDiv(value, covered, qty);
    const trueCovered = covered === q ? valueMinor : mulDiv(valueMinor, covered, q);
    varianceMinor = trueCovered - estimatedCovered;
  }
  return {
    varianceMinor,
    next: { qty: qty + q, valueMinor: value + valueMinor - varianceMinor, lastUnitCostMinor },
  };
}

/** Stock on the shelf has no cost yet, so a priced receipt can't be averaged into it. */
export class UnvaluedStockError extends Error {
  constructor(readonly onHand: number) {
    super(`${onHand} unit(s) on hand have no cost yet; set their opening cost first`);
  }
}
