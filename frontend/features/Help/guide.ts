import ar from "./content/ar";
import en from "./content/en";

export const HELP_TOPICS = ["start", "orders", "returns", "accounts", "purchases", "inventory", "import", "reports"] as const;
export type HelpTopicId = (typeof HELP_TOPICS)[number];

/** A piece of a guide section. Text may use **bold** for button and field names. */
export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; title?: string; items: string[] }
  | { type: "list"; title?: string; items: string[] }
  | { type: "flow"; title?: string; items: string[] }
  | { type: "tip" | "warning"; text: string }
  | { type: "example"; title: string; lines: string[] }
  | { type: "faq"; items: { q: string; a: string }[] };

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

export type HelpGuide = Record<HelpTopicId, HelpTopic>;

export const helpGuide = (language: string): HelpGuide => (language === "ar" ? ar : en);

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
