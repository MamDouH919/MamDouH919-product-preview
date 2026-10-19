import { LocalizedField } from "../globalTypes";

export type PageBlockType =
  | "hero"
  | "richText"
  | "image"
  | "imageText"
  | "gallery"
  | "features"
  | "stats"
  | "cta"
  | "faq"
  | "video"
  | "buttons"
  | "products"
  | "spacer"
  | "divider";

export type PageWidth = "sm" | "md" | "lg" | "xl" | "full";

export type BlockSpacing = "none" | "sm" | "md" | "lg" | "xl";

/** Presentation options every block shares. */
export type BlockStyle = {
  backgroundColor?: string;
  textColor?: string;
  paddingY?: BlockSpacing;
  width?: PageWidth | "inherit";
  align?: "start" | "center" | "end";
  anchor?: string;
};

export type PageBlock = {
  id: string;
  type: PageBlockType;
  visible: boolean;
  style: BlockStyle;
  data: Record<string, any>;
};

export type PageSettings = {
  maxWidth: PageWidth;
  backgroundColor?: string;
  textColor?: string;
  showTitle: boolean;
};

export type Page = {
  _id: string;
  slug: string;
  title: LocalizedField;
  metaTitle?: LocalizedField;
  metaDescription?: LocalizedField;
  ogImage?: string;
  isPublished: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  order: number;
  settings: PageSettings;
  blocks: PageBlock[];
  createdAt?: string;
  updatedAt?: string;
};

export type PagePayload = Omit<Page, "_id" | "createdAt" | "updatedAt">;

export type PageNavItem = Pick<Page, "_id" | "slug" | "title" | "showInHeader" | "showInFooter" | "order">;
