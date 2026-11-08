import type { MentionOptions } from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import api from "@/lib/api";
import type { ProductSearchResponse } from "@/backend-api/products/types";
import type { Category } from "@/backend-api/categories/types";
import type { SubCategory } from "@/backend-api/sub-categories/types";
import { mentionHref, type MentionKind } from "@/lib/mentions";
import SuggestionList, { type SuggestionListRef } from "./SuggestionList";

export type EditorLang = "ar" | "en";

/** One thing the `@` menu offers: a product, category or sub-category of this store. */
export type MentionSuggestion = {
  /** Unique within the menu: kind and id. */
  key: string;
  kind: MentionKind;
  /** The entity's id, stored on the mention. */
  id: string;
  /** Its name in the language being written. */
  label: string;
  /** Where the mention links to, without the locale. */
  href: string;
};

/** The attributes the mention node is created with (see mentionExtension). */
export type MentionNodeAttrs = { id: string; label: string; kind: MentionKind; href: string };

const MAX_PER_KIND = 5;

const name = (field: Record<string, string | undefined> | undefined, lang: EditorLang) =>
  field?.[lang] || field?.ar || field?.en || "";

const matches = (field: Record<string, string | undefined> | undefined, query: string) =>
  !query || Object.values(field ?? {}).some((v) => v?.toLowerCase().includes(query));

// Categories and sub-categories are few and change rarely: fetched once per
// minute, then filtered here as the user types. Products are searched on the server.
let taxonomy: { at: number; data: Promise<[Category[], SubCategory[]]> } | null = null;
function loadTaxonomy() {
  if (!taxonomy || Date.now() - taxonomy.at > 60_000) {
    const data = Promise.all([
      api.get<Category[]>("/categories").then((r) => r.data),
      api.get<SubCategory[]>("/sub-categories").then((r) => r.data),
    ]);
    taxonomy = { at: Date.now(), data };
    // A failed fetch shouldn't stick for a minute.
    data.catch(() => (taxonomy = null));
  }
  return taxonomy.data;
}

async function findMentions(query: string, lang: EditorLang): Promise<MentionSuggestion[]> {
  const q = query.trim().toLowerCase();
  const [products, [categories, subCategories]] = await Promise.all([
    api
      .get<ProductSearchResponse>("/products/search", { params: { q: q || undefined, limit: MAX_PER_KIND } })
      .then((r) => r.data.data)
      .catch(() => []),
    loadTaxonomy().catch((): [Category[], SubCategory[]] => [[], []]),
  ]);

  const items: MentionSuggestion[] = [
    ...products.map((p) => ({
      key: `product:${p._id}`,
      kind: "product" as const,
      id: p._id,
      label: name(p.name, lang),
      href: mentionHref("product", { slug: p.slug }),
    })),
    ...categories
      .filter((c) => c.isActive !== false && matches(c.name, q))
      .slice(0, MAX_PER_KIND)
      .map((c) => ({
        key: `category:${c._id}`,
        kind: "category" as const,
        id: c._id,
        label: name(c.name, lang),
        href: mentionHref("category", { slug: c.slug }),
      })),
    ...subCategories
      .filter((s) => s.isActive !== false && matches(s.name, q))
      .slice(0, MAX_PER_KIND)
      .map((s) => ({
        key: `subCategory:${s._id}`,
        kind: "subCategory" as const,
        id: s._id,
        label: name(s.name, lang),
        href: mentionHref("subCategory", {
          id: s._id,
          categoryId: typeof s.category === "string" ? s.category : s.category?._id,
        }),
      })),
  ];
  return items.filter((i) => i.label);
}

/**
 * Workaround for the current typing incompatibility between Tippy.js and Tiptap
 * Suggestion utility.
 *
 * @see https://github.com/ueberdosis/tiptap/issues/2795#issuecomment-1160623792
 */
const DOM_RECT_FALLBACK: DOMRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON() {
    return {};
  },
};

/** The `@` menu, listing names in `lang` (the language of the field being edited). */
export function createMentionSuggestion(lang: EditorLang): MentionOptions["suggestion"] {
  return {
    items: ({ query }) => findMentions(query, lang),

    render: () => {
      let component: ReactRenderer<SuggestionListRef> | undefined;
      let popup: TippyInstance | undefined;

      return {
        onStart: (props) => {
          component = new ReactRenderer(SuggestionList, {
            props: { ...props, lang },
            editor: props.editor,
          });

          popup = tippy("body", {
            getReferenceClientRect: () => props.clientRect?.() ?? DOM_RECT_FALLBACK,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          })[0];
        },

        onUpdate(props) {
          component?.updateProps({ ...props, lang });

          popup?.setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? DOM_RECT_FALLBACK,
          });
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.hide();
            return true;
          }

          if (!component?.ref) {
            return false;
          }

          return component.ref.onKeyDown(props);
        },

        onExit() {
          popup?.destroy();
          component?.destroy();

          // The suggestion plugin calls onExit both when an item is chosen and
          // when the editor is destroyed; dropping the references avoids a
          // second destroy, which Tippy reports as a leak.
          popup = undefined;
          component = undefined;
        },
      };
    },
  };
}
