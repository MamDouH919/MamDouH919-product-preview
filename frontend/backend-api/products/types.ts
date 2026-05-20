import { LocalizedField } from "../globalTypes";
import { Category } from "../categories/types";
import { SubCategory } from "../sub-categories/types";

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
  isActive: boolean;
  order: number;
};
