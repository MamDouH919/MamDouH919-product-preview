import { Mention } from "@tiptap/extension-mention";
import { createMentionSuggestion, type EditorLang } from "./mentionSuggestionOptions";

/**
 * A mention of the store's own product, category or sub-category, saved as a
 * real link: `<a data-type="mention" data-kind="product" href="/products/slug">Name</a>`.
 * Search engines follow it like any link (internal linking), and the
 * storefront adds the reader's locale to the href (lib/mentions).
 */
const EntityMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-kind"),
        renderHTML: (attrs) => (attrs.kind ? { "data-kind": attrs.kind } : {}),
      },
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute("href"),
        renderHTML: (attrs) => (attrs.href ? { href: attrs.href } : {}),
      },
    };
  },

  parseHTML() {
    return [
      // Ahead of the Link mark, which would otherwise read it as plain linked text.
      { tag: 'a[data-type="mention"]', priority: 100 },
      // Mentions saved before they were links.
      { tag: 'span[data-type="mention"]' },
    ];
  },
});

export function mentionExtension(lang: EditorLang) {
  return EntityMention.configure({
    HTMLAttributes: { class: "mention" },
    // The name alone, as a link: an "@" would read oddly in a product page's prose.
    renderHTML: ({ options, node }) =>
      node.attrs.href
        ? ["a", options.HTMLAttributes, node.attrs.label ?? ""]
        : ["span", options.HTMLAttributes, `@${node.attrs.label ?? node.attrs.id ?? ""}`],
    renderText: ({ node }) => node.attrs.label ?? "",
    suggestion: createMentionSuggestion(lang),
  });
}
