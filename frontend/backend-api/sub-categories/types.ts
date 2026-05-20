import { LocalizedField } from "../globalTypes";
import { Category } from "../categories/types";

export type SubCategory = {
  _id: string;
  name: LocalizedField;
  description?: LocalizedField;
  image?: string;
  slug: string;
  category: Category;
  isActive: boolean;
  order: number;
};
