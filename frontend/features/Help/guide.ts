import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ar from "./content/ar";
import en from "./content/en";
import { useStoreModules } from "@/Hooks/useStoreModules";
import type { StoreModule } from "@/lib/storeModules";

export const HELP_TOPICS = ["start", "orders", "returns", "accounts", "purchases", "inventory", "import", "reports"] as const;
export type HelpTopicId = (typeof HELP_TOPICS)[number];

/**
 * When a piece of the guide applies to a store: it `requires` every one of
 * these modules, and is left out `unless` the store lacks this one. Lets one
 * guide serve every plan, each store reading only about what it has.
 */
export interface HelpCondition {
  requires?: StoreModule[];
  unless?: StoreModule;
}

/** A list item, plain or with its own condition. */
type HelpItem = string | ({ text: string } & HelpCondition);

/** A piece of a guide section. Text may use **bold** for button and field names. */
type Block<Item> =
  | { type: "p"; text: string }
  | { type: "steps"; title?: string; items: Item[] }
  | { type: "list"; title?: string; items: Item[] }
  | { type: "flow"; title?: string; items: Item[] }
  | { type: "tip" | "warning"; text: string }
  | { type: "example"; title: string; lines: Item[] }
  | { type: "faq"; items: { q: string; a: string }[] };

/** A block as the page renders it: already fitted to the store. */
export type HelpBlock = Block<string>;

export interface HelpSection {
  title: string;
  /** The dashboard page this section explains, opened from its "open page" button. */
  path?: string;
  blocks: HelpBlock[];
}

export interface HelpTopic {
  label: string;
  summary: string;
  sections: HelpSection[];
}

/** The guide as written, for every plan; `useHelpGuide` fits it to one store. */
export type HelpGuideSource = Record<
  HelpTopicId,
  HelpCondition & {
    label: string;
    summary: string;
    sections: (HelpCondition & { title: string; path?: string; blocks: (Block<HelpItem> & HelpCondition)[] })[];
  }
>;

const sourceFor = (language: string): HelpGuideSource => (language === "ar" ? ar : en);

/**
 * The guide for this store: topics, sections, blocks and items its plan has
 * no use for are left out, and so is any section about a page it doesn't
 * have. `topics` keeps the guide's order.
 */
export const useHelpGuide = () => {
  const { i18n } = useTranslation();
  const { has, allows } = useStoreModules();

  return useMemo(() => {
    const applies = ({ requires, unless }: HelpCondition) =>
      (requires ?? []).every(has) && !(unless && has(unless));
    const items = (list: HelpItem[]) =>
      list.flatMap((item) => (typeof item === "string" ? [item] : applies(item) ? [item.text] : []));

    const fit = (block: Block<HelpItem>): HelpBlock => {
      switch (block.type) {
        case "steps":
        case "list":
        case "flow":
          return { ...block, items: items(block.items) };
        case "example":
          return { ...block, lines: items(block.lines) };
        default:
          return block;
      }
    };

    const guide: Partial<Record<HelpTopicId, HelpTopic>> = {};
    const source = sourceFor(i18n.language);
    for (const id of HELP_TOPICS) {
      const topic = source[id];
      if (!applies(topic)) continue;
      const sections = topic.sections
        .filter((section) => applies(section) && (!section.path || allows(section.path)))
        .map(({ title, path, blocks }) => ({
          title,
          path,
          blocks: blocks.filter(applies).map(fit),
        }));
      if (sections.length) guide[id] = { label: topic.label, summary: topic.summary, sections };
    }
    const topics = HELP_TOPICS.filter((id) => guide[id]);
    return { topics, guide: guide as Record<HelpTopicId, HelpTopic> };
  }, [i18n.language, has, allows]);
};

/** Which guide tab explains a dashboard route, for the help button on every page. */
const TOPIC_BY_ROUTE: [string, HelpTopicId][] = [
  ["/admin/orders", "orders"],
  ["/admin/returns", "returns"],
  ["/admin/refunds", "returns"],
  ["/admin/money-accounts", "accounts"],
  ["/admin/expenses", "accounts"],
  ["/admin/couriers", "accounts"],
  ["/admin/purchases", "purchases"],
  ["/admin/suppliers", "purchases"],
  ["/admin/inventory", "inventory"],
  ["/admin/products", "import"],
  ["/admin/database", "import"],
  ["/admin/reports", "reports"],
  ["/admin/books", "reports"],
];

/** `pathname` is the route without the locale, e.g. "/admin/returns/123". */
export const helpTopicFor = (pathname: string): HelpTopicId =>
  TOPIC_BY_ROUTE.find(([route]) => pathname === route || pathname.startsWith(route + "/"))?.[1] ?? "start";
