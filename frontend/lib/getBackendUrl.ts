/**
 * Resolves the tenant backend base URL at runtime.
 *
 * Priority:
 *   1. NEXT_PUBLIC_BACKEND_URL — explicit override (use this for local dev,
 *      where the backend runs on a different port, e.g. http://app.localhost:3055).
 *   2. Derived from the current host: `domain1.com` -> `https://api.domain1.com`.
 *
 * Leave NEXT_PUBLIC_BACKEND_URL unset in production so each tenant domain
 * automatically targets its own `api.<host>` backend.
 */
const api: Record<string, string> = {
  "localhost": "http://localhost:3044",
  "app.localhost": "http://app.localhost:3055",
  "demo.localhost": "http://demo.localhost:3055",
  "ranosh.novaslash.com": "https://api-ranosh.novaslash.com",
  "gravity.novaslash.com": "https://api-gravity.novaslash.com",
}

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    return backendUrlForHost(window.location.hostname);
  }

  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
}

/**
 * The backend for a given storefront host (port ignored). For server code —
 * metadata, sitemap, robots — which has a request host but no window.
 */
export function backendUrlForHost(host?: string | null): string {
  const override = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (override) return override;

  return api[host?.split(":")[0] ?? ""] ?? "";
}

/**
 * A stored image as an absolute URL. Images on R2 are stored as full URLs and
 * are returned as they are; older ones are backend paths ("/uploads/...").
 */
export function withBackend(base: string, path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
}

export function getTenantKey(): string {
  if (typeof window !== "undefined") {
    return window.location.hostname ?? "";
  }

  return "";
}
