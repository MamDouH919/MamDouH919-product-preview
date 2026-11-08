import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import appConfig from './config.json';

// One source for both: this used to say 'ar' while config said 'en', so "/"
// went to English and every other bare path to Arabic.
const locales = appConfig.app.languages;
const DEFAULT_LOCALE = appConfig.app.defaultLanguage;
const PUBLIC_FILE = /\.(.*)$/;

export function proxy(req: NextRequest) {
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

  // Detect locale from path
  const detectedLocale = locales.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );
  const locale = detectedLocale ?? req.cookies.get('NEXT_LOCALE')?.value ?? DEFAULT_LOCALE;

  // If no locale prefix, redirect to add one ("/" → "/ar", not "/ar/", which
  // would cost a second redirect).
  if (!detectedLocale) {
    const target = new URL(`/${locale}${pathname === '/' ? '' : pathname}`, req.url);
    target.search = req.nextUrl.search;
    const response = NextResponse.redirect(target);
    response.cookies.set('NEXT_LOCALE', locale, { maxAge: 31536000 });
    return response;
  }

  // ── Auth guards ──────────────────────────────────────────────────────────────
  // Two independent sessions: `token` is a dashboard admin, `customer_token` is
  // a storefront customer. They are never interchangeable — an admin session
  // must not open /account, and a customer session must not open /admin.
  const token = req.cookies.get('token')?.value;
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
  if (isAdminRoute && !token) {
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
