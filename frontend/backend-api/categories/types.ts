import { LocalizedField } from "../globalTypes";

export type Category = {
  _id: string;
  name: LocalizedField;
  description?: LocalizedField;
  image?: string;
  slug: string;
  isActive: boolean;
  order: number;
  /** Google product taxonomy id or path, for shopping feeds. */
  googleProductCategory?: string;
};
