import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { backendUrlForHost } from './lib/getBackendUrl';
import {
  FALLBACK_LOCALES,
  isStaffPath,
  isSupportedLocale,
  parseStoreLocales,
  splitLocale,
  type StoreLocales,
} from './lib/locales';

const PUBLIC_FILE = /\.(.*)$/;

// ── The store's languages ──────────────────────────────────────────────────
// Asked of the API (an in-memory read there) and kept here per host, so a
// page view doesn't wait on it: past the TTL the last answer is used while a
// fresh one is fetched. Best-effort — each server instance has its own copy,
// and a cold one with the API down routes by the defaults rather than fail.

/** Same as the layout's settings cache: a change on the platform shows within a minute. */
const LOCALES_TTL_MS = 60_000;
/**
 * How long a failed ask is remembered. Without it, an API that is down — or
 * still the version without /settings/languages — would be asked again by
 * every page view, each waiting on it.
 */
const LOCALES_FAILURE_TTL_MS = 15_000;
/** On the routing path of a cold instance, so it gives up quickly. */
const LOCALES_TIMEOUT_MS = 1_500;

/** `value: null` records a failed ask; a stale success is kept rather than overwritten by one. */
const localesCache = new Map<string, { value: StoreLocales | null; expires: number }>();
const localesInflight = new Map<string, Promise<StoreLocales | null>>();

async function fetchStoreLocales(host: string): Promise<StoreLocales | null> {
  const backendUrl = backendUrlForHost(host);
  let value: StoreLocales | null = null;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/settings/languages`, {
        signal: AbortSignal.timeout(LOCALES_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (res.ok) value = parseStoreLocales(await res.json());
    } catch {
      // Unreachable or too slow: recorded below like any other failure.
    }
  }

  if (value) {
    localesCache.set(host, { value, expires: Date.now() + LOCALES_TTL_MS });
    return value;
  }
  // Keep routing by the last known answer; ask again after a short pause.
  const previous = localesCache.get(host)?.value ?? null;
  localesCache.set(host, { value: previous, expires: Date.now() + LOCALES_FAILURE_TTL_MS });
  return previous;
}

function refreshStoreLocales(host: string): Promise<StoreLocales | null> {
  let pending = localesInflight.get(host);
  if (!pending) {
    pending = fetchStoreLocales(host).finally(() => localesInflight.delete(host));
    localesInflight.set(host, pending);
  }
  return pending;
}

/** The store's languages, or null when they aren't known (API unreachable, nothing cached). */
async function storeLocales(host: string): Promise<StoreLocales | null> {
  const cached = localesCache.get(host);
  if (cached) {
    if (cached.expires <= Date.now()) void refreshStoreLocales(host);
    return cached.value;
  }
  return refreshStoreLocales(host);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicFile = PUBLIC_FILE.test(pathname);

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo') ||
    isPublicFile
  ) {
    return NextResponse.next();
  }

  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host).split(',')[0].trim();
  const { locale: pathLocale, rest } = splitLocale(pathname);
  const staff = isStaffPath(pathLocale ? rest : pathname);

  // No locale in the path: add one. The visitor's last language if the site
  // has it, else the store's default ("/" → "/en", not "/en/", which would
  // cost a second redirect). Temporary, as it depends on the cookie.
  if (!pathLocale) {
    const store = await storeLocales(host);
    const allowed = staff ? undefined : (store ?? FALLBACK_LOCALES).languages;
    const remembered = req.cookies.get('NEXT_LOCALE')?.value;
    const locale =
      isSupportedLocale(remembered) && (!allowed || allowed.includes(remembered))
        ? remembered
        : (store ?? FALLBACK_LOCALES).defaultLanguage;
    const target = new URL(`/${locale}${pathname === '/' ? '' : pathname}`, req.url);
    target.search = req.nextUrl.search;
    const response = NextResponse.redirect(target);
    response.cookies.set('NEXT_LOCALE', locale, { maxAge: 31536000 });
    return response;
  }

  // A language the site isn't published in: the same page in its default
  // language, permanently, so links and search ranking carry over. Staff
  // pages are left alone (see isStaffPath). With the languages unknown the
  // page is served as asked: a wrong redirect would be worse than none.
  if (!staff) {
    const store = await storeLocales(host);
    if (store && !store.languages.includes(pathLocale)) {
      const target = new URL(`/${store.defaultLanguage}${rest}`, req.url);
      target.search = req.nextUrl.search;
      return NextResponse.redirect(target, 301);
    }
  }

  const locale = pathLocale;

  // ── Auth guards ──────────────────────────────────────────────────────────────
  // Two independent sessions: `token` is a dashboard admin, `customer_token` is
  // a storefront customer. They are never interchangeable — an admin session
  // must not open /account, and a customer session must not open /admin.
  const token = req.cookies.get('token')?.value;
  // The access cookie may be gone while the refresh token still holds the
  // session; the dashboard trades it for a new access token on load.
  const adminRefreshToken = req.cookies.get('refresh_token')?.value;
  const customerToken = req.cookies.get('customer_token')?.value;

  const isAccountRoute = pathname.includes('/account');
  const isAdminRoute = pathname.includes('/admin');

  // Pages under /account a guest is meant to reach.
  const isCustomerAuthRoute =
    pathname.includes('/account/login') ||
    pathname.includes('/account/register') ||
    pathname.includes('/account/forgot-password') ||
    pathname.includes('/account/reset-password');

  // The admin login lives at /<locale>/login — match it exactly so
  // /account/login is not caught by it.
  const isAdminLoginRoute = pathname === `/${locale}/login`;

  // ── Storefront customer ──
  if (isAccountRoute && !isCustomerAuthRoute && !customerToken) {
    const loginUrl = new URL(`/${locale}/account/login`, req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isCustomerAuthRoute && customerToken) {
    return NextResponse.redirect(new URL(`/${locale}/account`, req.url));
  }

  // ── Dashboard admin ──
  if (isAdminRoute && !token && !adminRefreshToken) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminLoginRoute && token) {
    return NextResponse.redirect(new URL(`/${locale}/admin`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|logo|images|.*\\..*).*)'],
};
