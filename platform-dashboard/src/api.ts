const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3023').replace(/\/+$/, '');
const TOKEN_KEY = 'platform-token';

export interface Tenant {
  host: string;
  frontendUrl: string;
  aliasOf: string | null;
  disabled: boolean;
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
  aliasOf?: string;
}

export interface TenantPatch {
  mongoUri?: string;
  frontendUrl?: string;
  aliasOf?: string | null;
  disabled?: boolean;
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

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    throw new ApiError(res.status, message || res.statusText || 'Request failed');
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

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
};
