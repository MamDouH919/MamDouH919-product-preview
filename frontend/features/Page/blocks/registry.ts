import {
  BarChart3,
  Columns2,
  Grid3x3,
  HelpCircle,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  PlaySquare,
  ShoppingBag,
  Sparkles,
  Type,
} from "lucide-react";
import { BlockStyle, PageBlock, PageBlockType } from "@/backend-api/pages/types";
import { LocalizedField } from "@/backend-api/globalTypes";

export const LANGS = ["ar", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const emptyL = (): LocalizedField => ({ ar: "", en: "" });

/** Reads a localized field, falling back to whichever language has text. */
export const loc = (field: LocalizedField | undefined, lang: string): string =>
  field ? field[lang] || field.ar || field.en || "" : "";

export type ButtonItem = {
  label: LocalizedField;
  url: string;
  variant: "primary" | "outline" | "light";
};

export const newButton = (): ButtonItem => ({ label: emptyL(), url: "", variant: "primary" });

type BlockDefinition = {
  type: PageBlockType;
  /** Translation key of the block's name. */
  labelKey: string;
  /** Translation key of a one-line description shown in the picker. */
  descriptionKey: string;
  icon: React.ElementType;
  defaultData: () => Record<string, any>;
  defaultStyle?: BlockStyle;
};

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: "hero",
    labelKey: "blockHero",
    descriptionKey: "blockHeroDesc",
    icon: LayoutTemplate,
    defaultData: () => ({
      image: "",
      title: emptyL(),
      subtitle: emptyL(),
      buttons: [],
      height: "md",
      overlay: 45,
    }),
    defaultStyle: { width: "full", paddingY: "none", align: "center" },
  },
  {
    type: "richText",
    labelKey: "blockRichText",
    descriptionKey: "blockRichTextDesc",
    icon: Type,
    defaultData: () => ({ content: emptyL() }),
  },
  {
    type: "image",
    labelKey: "blockImage",
    descriptionKey: "blockImageDesc",
    icon: ImageIcon,
    defaultData: () => ({ image: "", alt: emptyL(), caption: emptyL(), rounded: true, link: "" }),
  },
  {
    type: "imageText",
    labelKey: "blockImageText",
    descriptionKey: "blockImageTextDesc",
    icon: Columns2,
    defaultData: () => ({
      image: "",
      title: emptyL(),
      content: emptyL(),
      imagePosition: "start",
      buttons: [],
    }),
  },
  {
    type: "gallery",
    labelKey: "blockGallery",
    descriptionKey: "blockGalleryDesc",
    icon: Grid3x3,
    defaultData: () => ({ title: emptyL(), columns: 3, images: [] }),
  },
  {
    type: "features",
    labelKey: "blockFeatures",
    descriptionKey: "blockFeaturesDesc",
    icon: Sparkles,
    defaultData: () => ({
      title: emptyL(),
      subtitle: emptyL(),
      columns: 3,
      items: [{ icon: "Star", title: emptyL(), description: emptyL() }],
    }),
  },
  {
    type: "stats",
    labelKey: "blockStats",
    descriptionKey: "blockStatsDesc",
    icon: BarChart3,
    defaultData: () => ({ title: emptyL(), items: [{ value: "100+", label: emptyL() }] }),
  },
  {
    type: "cta",
    labelKey: "blockCta",
    descriptionKey: "blockCtaDesc",
    icon: Megaphone,
    defaultData: () => ({ title: emptyL(), text: emptyL(), buttons: [newButton()] }),
    defaultStyle: { align: "center" },
  },
  {
    type: "faq",
    labelKey: "blockFaq",
    descriptionKey: "blockFaqDesc",
    icon: HelpCircle,
    defaultData: () => ({ title: emptyL(), items: [{ question: emptyL(), answer: emptyL() }] }),
  },
  {
    type: "video",
    labelKey: "blockVideo",
    descriptionKey: "blockVideoDesc",
    icon: PlaySquare,
    defaultData: () => ({ url: "", title: emptyL() }),
  },
  {
    type: "buttons",
    labelKey: "blockButtons",
    descriptionKey: "blockButtonsDesc",
    icon: MousePointerClick,
    defaultData: () => ({ buttons: [newButton()] }),
    defaultStyle: { align: "center" },
  },
  {
    type: "products",
    labelKey: "blockProducts",
    descriptionKey: "blockProductsDesc",
    icon: ShoppingBag,
    defaultData: () => ({ title: emptyL(), categoryId: "", sort: "featured", limit: 8 }),
  },
  {
    type: "spacer",
    labelKey: "blockSpacer",
    descriptionKey: "blockSpacerDesc",
    icon: MoveVertical,
    defaultData: () => ({ height: 48 }),
    defaultStyle: { paddingY: "none" },
  },
  {
    type: "divider",
    labelKey: "blockDivider",
    descriptionKey: "blockDividerDesc",
    icon: Minus,
    defaultData: () => ({ thickness: 1, color: "" }),
    defaultStyle: { paddingY: "sm" },
  },
];

export const BLOCKS_BY_TYPE = Object.fromEntries(
  BLOCK_DEFINITIONS.map((d) => [d.type, d]),
) as Record<PageBlockType, BlockDefinition>;

const DEFAULT_STYLE: BlockStyle = { paddingY: "md", width: "inherit", align: "start" };

export const newBlockId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createBlock = (type: PageBlockType): PageBlock => {
  const def = BLOCKS_BY_TYPE[type];
  return {
    id: newBlockId(),
    type,
    visible: true,
    style: { ...DEFAULT_STYLE, ...def.defaultStyle },
    data: def.defaultData(),
  };
};

/** Short text identifying a block in the builder list. */
export const blockSummary = (block: PageBlock, lang: string): string => {
  const d = block.data ?? {};
  const text =
    loc(d.title, lang) ||
    loc(d.caption, lang) ||
    loc(d.label, lang) ||
    (typeof d.url === "string" ? d.url : "") ||
    (d.content ? loc(d.content, lang).replace(/<[^>]+>/g, " ") : "");
  return text.replace(/\s+/g, " ").trim().slice(0, 70);
};

/** Only same-site paths and ordinary web/mail/phone links are rendered as links. */
export const safeHref = (url: string | undefined): string | null => {
  const value = (url ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  return null;
};
