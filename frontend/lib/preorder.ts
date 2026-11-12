/** Units of a product or variant held in one warehouse. */
export type WarehouseStock = { warehouse: string; qty: number };

/**
 * Units that can be pre-ordered: what the other warehouses hold, less what
 * the main one already owes (its `stock` below zero). The server does the
 * same sum when the order is placed, and has the final word.
 */
export function preorderUnits(source: { stock?: number; stocks?: WarehouseStock[] } | undefined): number {
  if (!source?.stocks?.length) return 0
  const total = source.stocks.reduce((t, e) => t + (e.qty ?? 0), 0)
  return Math.max(0, total - Math.max(source.stock ?? 0, 0))
}
