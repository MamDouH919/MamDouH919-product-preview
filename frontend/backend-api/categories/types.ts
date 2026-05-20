import { LocalizedField } from "../globalTypes";

export type Category = {
  _id: string;
  name: LocalizedField;
  description?: LocalizedField;
  image?: string;
  slug: string;
  isActive: boolean;
  order: number;
};
