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
  stock: number;
  lowStockThreshold: number;
  status: StockStatus;
  price?: number;
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
  stockValue: number;
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
  type: MovementType;
  /** Always positive — the type decides whether stock goes up or down. */
  quantity: number;
  reason?: string;
  reference?: string;
};

export type StockTakePayload = {
  productId: string;
  variantId?: string;
  countedQuantity: number;
  reason?: string;
};

export type InventoryFilters = {
  status?: "all" | "low" | "out" | "in_stock";
  categoryId?: string;
  search?: string;
};

export type MovementFilters = {
  productId?: string;
  variantId?: string;
  type?: MovementType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};
