import { LocalizedField } from "../globalTypes";
import { Category } from "../categories/types";
import { SubCategory } from "../sub-categories/types";

export type ProductVariant = {
  _id: string;
  label: string;
  price?: number;
  sku?: string;
  stock: number;
};

export type Product = {
  _id: string;
  name: LocalizedField;
  description?: LocalizedField;
  shortDescription?: LocalizedField;
  images: string[];
  price?: number;
  sku?: string;
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
