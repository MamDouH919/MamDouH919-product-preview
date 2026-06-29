import type { TenantSeo } from "./tenants/types";
import localhost from "./tenants/localhost";
import appLocalhost from "./tenants/appLocalhost";
import ranosh from "./tenants/ranosh";

export type { TenantSeo, LocaleSeo } from "./tenants/types";

/**
 * Per-host SEO + icons. Keys are the hostname WITHOUT port
 * (e.g. "app.localhost", not "app.localhost:3000").
 * Add a new tenant by creating a file under ./tenants and registering it here.
 */
export const TENANT_SEO: Record<string, TenantSeo> = {
  localhost,
  "app.localhost": appLocalhost,
  "ranosh.localhost": ranosh,
  "ranosh.novaslash.com": ranosh,
};

export const DEFAULT_TENANT = "localhost";

/** Resolves a hostname (with or without port) to a tenant SEO config. */
export function resolveTenantSeo(host?: string | null): TenantSeo {
  const hostname = host?.split(":")[0] ?? "";
  return TENANT_SEO[hostname] ?? TENANT_SEO[DEFAULT_TENANT];
}
