import type { WarehouseStock } from "@/lib/preorder";
import { LocalizedField } from "../globalTypes";
import { Category } from "../categories/types";
import { SubCategory } from "../sub-categories/types";

export type ProductVariant = {
  _id: string;
  label: string;
  price?: number;
  sku?: string;
  /** Price before a discount; a sale only when higher than `price`. */
  compareAtPrice?: number | null;
  gtin?: string;
  color?: string;
  size?: string;
  /** Units in the main warehouse — what can be sold now. */
  stock: number;
  /** Units per warehouse, the main one included. */
  stocks?: WarehouseStock[];
  /** Cost of one unit at the last receipt, in minor units. Read-only; set by the inventory ledger. */
  lastUnitCostMinor?: number | null;
};

export type Product = {
  _id: string;
  name: LocalizedField;
  description?: LocalizedField;
  shortDescription?: LocalizedField;
  images: string[];
  price?: number;
  /** Price before a discount; a sale only when higher than `price`. */
  compareAtPrice?: number | null;
  sku?: string;
  /** Empty: the store's own product. */
  brand?: string;
  gtin?: string;
  category: Category;
  subCategory?: SubCategory;
  slug: string;
  tags: string[];
  variants: ProductVariant[];
  isActive: boolean;
  order: number;
  trackStock: boolean;
  /** Product-level stock. Meaningful only when `variants` is empty. */
  stock: number;
  /** Units per warehouse, the main one included. Product-level, like `stock`. */
  stocks?: WarehouseStock[];
  /** Cost of one unit at the last receipt, in minor units. Product-level, like `stock`. */
  lastUnitCostMinor?: number | null;
  lowStockThreshold: number;
  allowBackorder: boolean;
  /** Virtual: product stock, or the sum of its variants. */
  totalStock?: number;
  views: number;
  whatsappClicks: number;
  /** Average of approved reviews, 0 when there are none. */
  ratingAverage?: number;
  ratingCount?: number;
};

export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc";

export type ProductSearchParams = {
  q?: string;
  categoryId?: string;
  subCategoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
};

/** A search hit: a product plus what the server derived for filtering. */
export type ProductSearchItem = Product & {
  /** Cheapest variant price, or the product price. */
  effectivePrice?: number | null;
  inStock?: boolean;
};

export type ProductSearchResponse = {
  data: ProductSearchItem[];
  total: number;
  page: number;
  limit: number;
};
