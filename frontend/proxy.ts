import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['ar', 'en'];
const DEFAULT_LOCALE = 'ar';
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

  // If no locale prefix, redirect to add one
  if (!detectedLocale) {
    const response = NextResponse.redirect(new URL(`/${locale}${pathname}`, req.url));
    response.cookies.set('NEXT_LOCALE', locale, { maxAge: 31536000 });
    return response;
  }

  // ── Auth guards ──────────────────────────────────────────────────────────────
  const token = req.cookies.get('token')?.value;
  const isAdminRoute = pathname.includes('/admin');
  const isLoginRoute = pathname.includes('/login');

  // No token → redirect to login
  if (isAdminRoute && !token) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → redirect away from login
  if (isLoginRoute && token) {
    return NextResponse.redirect(new URL(`/${locale}/admin`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|logo|images|.*\\..*).*)'],
};
