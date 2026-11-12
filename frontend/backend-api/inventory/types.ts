import { LocalizedField } from "../globalTypes";
import { Category } from "../categories/types";

export enum MovementType {
  OPENING = "opening",
  PURCHASE = "purchase",
  SALE = "sale",
  RETURN = "return",
  DAMAGE = "damage",
  ORDER_CANCELLED = "order_cancelled",
  ADJUSTMENT_IN = "adjustment_in",
  ADJUSTMENT_OUT = "adjustment_out",
  PURCHASE_RETURN = "purchase_return",
  COST_SET = "cost_set",
  TRANSFER_OUT = "transfer_out",
  TRANSFER_IN = "transfer_in",
}

/**
 * Served by `GET /inventory/movement-types`. Which types an admin may pick and
 * which way each one moves stock are the server's rules, so the UI reads them
 * instead of keeping a second copy that can drift.
 */
export type MovementTypeInfo = {
  type: MovementType;
  direction: 1 | -1;
  manual: boolean;
};

export type StockStatus = "out" | "low" | "in_stock" | "untracked";

export type StockLevel = {
  productId: string;
  variantId?: string;
  name: LocalizedField;
  variantLabel?: string;
  sku?: string;
  image?: string;
  category?: Category;
  trackStock: boolean;
  /** Units in the main warehouse — what can be sold now. Negative: pre-orders owed. */
  stock: number;
  /** Units in every warehouse together. */
  totalStock: number;
  /** Units per warehouse. */
  stocks: { warehouseId: string; qty: number }[];
  /** Units that can still be pre-ordered from the other warehouses. */
  preorderStock: number;
  lowStockThreshold: number;
  status: StockStatus;
  price?: number;
  /** Whether the stock has a cost yet — stock from before the books has none until it is set. */
  valued: boolean;
  /** Cost of the stock on hand, minor units; null until it has a cost. */
  valueMinor: number | null;
  /** Average cost of one unit, minor units. */
  unitCostMinor: number | null;
  /** Has a cost and nothing but the opening has touched it, so that cost can still be corrected. */
  costCorrectable: boolean;
};

export type StockMovement = {
  _id: string;
  product: {
    _id: string;
    name: LocalizedField;
    slug: string;
    images?: string[];
    sku?: string;
  };
  variantId?: string;
  variantLabel?: string;
  warehouse?: { _id: string; name: LocalizedField; code: string };
  type: MovementType;
  /** Signed: positive added stock, negative removed it. */
  quantity: number;
  balanceAfter: number;
  reason?: string;
  reference?: string;
  user?: { _id: string; name: string; email: string };
  createdAt: string;
};

export type InventorySummary = {
  trackedItems: number;
  totalUnits: number;
  /** At selling prices — what the stock would fetch. */
  stockValue: number;
  /** At cost, minor units — what the books carry. Uncosted stock isn't in it. */
  costValueMinor: number;
  /** Items with stock on hand but no cost yet. */
  uncostedItems: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export type MovementsResponse = {
  data: StockMovement[];
  total: number;
  page: number;
  limit: number;
};

export type AdjustStockPayload = {
  productId: string;
  variantId?: string;
  /** Left out means the main warehouse. */
  warehouseId?: string;
  type: MovementType;
  /** Always positive — the type decides whether stock goes up or down. */
  quantity: number;
  reason?: string;
  reference?: string;
};

export type StockTakePayload = {
  productId: string;
  variantId?: string;
  warehouseId?: string;
  countedQuantity: number;
  reason?: string;
};

export type InventoryFilters = {
  status?: "all" | "low" | "out" | "in_stock";
  categoryId?: string;
  warehouseId?: string;
  search?: string;
};

export type MovementFilters = {
  productId?: string;
  variantId?: string;
  warehouseId?: string;
  type?: MovementType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type Warehouse = {
  _id: string;
  name: LocalizedField;
  code: string;
  address?: string;
  notes?: string;
  isMain: boolean;
  isActive: boolean;
  /** Units held, all items together. Negative only on the main one (pre-orders owed). */
  units: number;
  /** Items with any units here. */
  items: number;
};

export type WarehousesResponse = {
  data: Warehouse[];
  /** How many open warehouses the store's plan allows. */
  max: number;
};

export type WarehousePayload = {
  name: LocalizedField;
  code: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
};

export type StockTransfer = {
  _id: string;
  transferNumber: number;
  from: { _id: string; name: LocalizedField; code: string };
  to: { _id: string; name: LocalizedField; code: string };
  lines: { product: string; variantId?: string; name: LocalizedField; variantLabel?: string; sku?: string; quantity: number }[];
  totalUnits: number;
  note?: string;
  createdBy?: { _id: string; name: string };
  createdAt: string;
};

export type TransfersResponse = { data: StockTransfer[]; total: number; page: number; limit: number };

export type TransferPayload = {
  fromWarehouseId: string;
  toWarehouseId: string;
  lines: { productId: string; variantId?: string; quantity: number }[];
  note?: string;
};
