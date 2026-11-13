const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3023').replace(/\/+$/, '');
const TOKEN_KEY = 'platform-token';

/**
 * What a store is sold as. `catalog` shows products only; `orders` adds online
 * orders without stock, couriers or the books; `full` has everything.
 */
export type StorePlan = 'catalog' | 'orders' | 'full';

export const PLAN_LABELS: Record<StorePlan, string> = {
  full: 'Full shop',
  orders: 'Orders only',
  catalog: 'Catalog only',
};

/** Languages the storefront has translations for. Mirrors the API's SUPPORTED_LANGUAGES. */
export type StoreLanguage = 'en' | 'ar';

export const LANGUAGE_LABELS: Record<StoreLanguage, string> = {
  en: 'English',
  ar: 'Arabic (العربية)',
};

export interface Tenant {
  host: string;
  frontendUrl: string;
  extraFrontendUrls: string[];
  aliasOf: string | null;
  disabled: boolean;
  /** An alias's own plan is ignored: it serves its primary host's. */
  plan: StorePlan;
  /** The storefront's languages; an alias's own are ignored, it serves its primary host's. */
  languages: StoreLanguage[];
  defaultLanguage: StoreLanguage;
  /** How many open warehouses the store may keep. */
  maxWarehouses: number;
  /** The paid add-on that gives the store's dashboard users and roles pages. An alias follows its primary store. */
  team: boolean;
  /** Connection string with credentials replaced by `***`. */
  database: string;
  connected: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantInput {
  host: string;
  mongoUri: string;
  frontendUrl: string;
  extraFrontendUrls?: string[];
  aliasOf?: string;
  plan?: StorePlan;
  languages?: StoreLanguage[];
  defaultLanguage?: StoreLanguage;
  maxWarehouses?: number;
  team?: boolean;
}

export interface TenantPatch {
  mongoUri?: string;
  frontendUrl?: string;
  extraFrontendUrls?: string[];
  aliasOf?: string | null;
  disabled?: boolean;
  plan?: StorePlan;
  languages?: StoreLanguage[];
  defaultLanguage?: StoreLanguage;
  maxWarehouses?: number;
  team?: boolean;
}

export type PriceKind = 'price' | 'compareAtPrice' | 'cost';
export type PriceSource =
  | 'product_created'
  | 'product_edit'
  | 'purchase'
  | 'opening_stock'
  | 'opening_cost'
  | 'opening_cost_corrected';

export const PRICE_KIND_LABELS: Record<PriceKind, string> = {
  price: 'Selling price',
  compareAtPrice: 'Price before discount',
  cost: 'Cost',
};

export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  product_created: 'New product',
  product_edit: 'Product edit',
  purchase: 'Purchase received',
  opening_stock: 'Opening stock',
  opening_cost: 'Opening cost set',
  opening_cost_corrected: 'Opening cost corrected',
};

export interface PriceChange {
  id: string;
  host: string;
  productId: string;
  productName: string;
  sku: string | null;
  variantLabel: string | null;
  kind: PriceKind;
  /** In the store's currency; null when there was none before. */
  oldValue: number | null;
  /** Null when the price was cleared. */
  newValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  source: PriceSource;
  userName: string | null;
  userEmail: string | null;
  at: string;
}

export interface PriceChangeQuery {
  host?: string;
  kind?: PriceKind;
  source?: PriceSource;
  q?: string;
  /** ISO date-times. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PriceChangeSummary {
  total: number;
  byKind: Record<PriceKind, number>;
  /** Different products touched. */
  products: number;
}

export interface TenantCheck {
  ok: boolean;
  latencyMs?: number;
  transactions?: boolean;
  collections?: number;
  users?: number;
  error?: string;
}

export interface SeedUser {
  name: string;
  email: string;
  password: string;
}

export type BackupKind = 'daily' | 'manual' | 'pre-restore';

export interface Backup {
  id: string;
  kind: BackupKind;
  createdAt: string;
  /** Compressed size in bytes. */
  size: number;
}

export interface RestoreReport {
  dryRun: boolean;
  host: string;
  exportedAt?: string;
  collections: { name: string; documents: number }[];
  skipped: string[];
  errors: string[];
  restored: boolean;
  /** Backup of the state just before a real restore, to undo it. */
  safetyBackup?: string;
}

export type ErrorStatus = 'new' | 'resolved' | 'ignored';

export interface ErrorGroup {
  id: string;
  /** The store's host, or `platform`. */
  host: string;
  method: string;
  route: string;
  statusCode: number;
  name: string;
  message: string;
  stack: string | null;
  count: number;
  status: ErrorStatus;
  note: string | null;
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
}

export interface ErrorQuery {
  host?: string;
  status?: ErrorStatus;
  statusCode?: number;
  q?: string;
  page: number;
  limit: number;
}

export interface ErrorStats {
  totals: { groups: number; new: number; resolved: number; ignored: number; events: number };
  perDay: { date: string; count: number }[];
  byHost: { host: string; count: number }[];
}

export class ApiError extends Error {
  readonly status: number;
  /** Extra fields of the error body, e.g. a refused restore's `report`. */
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}

/** Called when the API answers 401, so the app can drop back to the login page. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !path.startsWith('/platform/auth/login')) onUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join('\n') : data?.message;
    throw new ApiError(res.status, message || res.statusText || 'Request failed', data);
  }
  return res;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body);
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Saves a response body as a file in the browser. */
async function download(path: string, filename: string): Promise<void> {
  const blob = await (await send('GET', path)).blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v));
  const text = search.toString();
  return text ? `?${text}` : '';
};

const host = (h: string) => `/platform/tenants/${encodeURIComponent(h)}`;

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; email: string }>('POST', '/platform/auth/login', { email, password }),
  me: () => request<{ email: string }>('GET', '/platform/auth/me'),

  listTenants: () => request<Tenant[]>('GET', '/platform/tenants'),
  createTenant: (input: TenantInput) => request<Tenant>('POST', '/platform/tenants', input),
  updateTenant: (h: string, patch: TenantPatch) => request<Tenant>('PATCH', host(h), patch),
  deleteTenant: (h: string) => request<void>('DELETE', host(h)),
  checkTenant: (h: string) => request<TenantCheck>('POST', `${host(h)}/check`),
  seedTenant: (h: string, body: { admin: SeedUser; superAdmin?: SeedUser }) =>
    request<{ log: string[] }>('POST', `${host(h)}/seed`, body),

  listErrors: (query: ErrorQuery) =>
    request<{ items: ErrorGroup[]; total: number }>('GET', `/platform/errors${qs({ ...query })}`),
  errorStats: (days: number) => request<ErrorStats>('GET', `/platform/errors/stats${qs({ days })}`),
  updateError: (id: string, patch: { status?: ErrorStatus; note?: string }) =>
    request<ErrorGroup>('PATCH', `/platform/errors/${encodeURIComponent(id)}`, patch),
  deleteError: (id: string) => request<void>('DELETE', `/platform/errors/${encodeURIComponent(id)}`),

  listPriceChanges: (query: PriceChangeQuery) =>
    request<{ items: PriceChange[]; total: number }>('GET', `/platform/price-changes${qs({ ...query })}`),
  priceChangeSummary: (days: number, host?: string) =>
    request<PriceChangeSummary>('GET', `/platform/price-changes/summary${qs({ days, host })}`),

  listBackups: (h: string) => request<Backup[]>('GET', `${host(h)}/backups`),
  createBackup: (h: string) => request<Backup>('POST', `${host(h)}/backups`),
  downloadBackup: (h: string, id: string) =>
    download(`${host(h)}/backups/${encodeURIComponent(id)}`, `${h}_${id}`),
  restoreBackup: (h: string, id: string, body: { dryRun: boolean; confirm?: string }) =>
    request<RestoreReport>('POST', `${host(h)}/backups/${encodeURIComponent(id)}/restore`, body),
};
