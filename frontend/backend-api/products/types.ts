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
};
