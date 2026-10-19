/**
 * Strips the parts of admin-authored HTML that can run script on the
 * storefront: <script>/<iframe>/<object>/<embed>/<style> elements, inline
 * event handlers (onclick=…) and javascript:/vbscript: URLs. Rich-text output
 * from the dashboard editor never needs any of these, so removing them keeps
 * a compromised or careless admin account from injecting code into pages
 * customers open.
 */
export function sanitizeHtml(value: string): string {
  return value
    .replace(/<\s*(script|iframe|object|embed|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|formaction)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, '$1="#"')
    .replace(/^\s*(javascript|vbscript):.*$/i, '');
}

/** Applies `sanitizeHtml` to every string nested anywhere inside `value`. */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sanitizeHtml(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeDeep(v)]),
    ) as T;
  }
  return value;
}
