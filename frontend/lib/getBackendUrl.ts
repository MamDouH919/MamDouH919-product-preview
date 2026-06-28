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
  "localhost": "http://localhost:3055",
  "app.localhost": "http://app.localhost:3055",
  "demo.localhost": "http://demo.localhost:3055",
  "ranosh.novaslash.com": "https://api-ranosh.novaslash.com",
}

export function getBackendUrl(): string {
  const override = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (override) return override;

  if (typeof window !== "undefined") {
    return api[window.location.hostname] ?? "";
  }

  return "";
}

export function getTenantKey(): string {
  if (typeof window !== "undefined") {
    return window.location.hostname ?? "";
  }

  return "";
}
