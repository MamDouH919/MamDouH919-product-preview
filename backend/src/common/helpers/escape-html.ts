const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Makes user-supplied text safe to drop into an HTML email. Anything a
 * customer typed — a name, an address, order notes — goes through this, or a
 * crafted value could inject links or markup into a message sent from the
 * store's own address.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
