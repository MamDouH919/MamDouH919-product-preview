"use server";
import { cookies } from 'next/headers'

// const cookieOptions = {
//     secure: false,
//     // secure: process.env.NODE_ENV === "production",
//     sameSite: "lax" as const,
//     path: "/",
//     maxAge: 60 * 60 * 24 * 7, // 7 days
//     httpOnly: true,
// };

const cookieOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
};

// ── Dashboard admin ───────────────────────────────────────────────────────────
// Both cookies outlive a browser restart for as long as the refresh token is
// valid (7 days, sliding). The access token itself expires sooner (12h); the
// api client trades the refresh token for a new pair when that happens.
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function setAdminSession(accessToken: string, refreshToken: string) {
    const cookieStore = await cookies()
    cookieStore.set('token', accessToken, { ...cookieOptions, maxAge: ADMIN_SESSION_MAX_AGE })
    // Never read by page scripts directly — only through getRefreshTokenFromCookie.
    cookieStore.set('refresh_token', refreshToken, {
        ...cookieOptions,
        maxAge: ADMIN_SESSION_MAX_AGE,
        httpOnly: true,
    })
}

export async function getRefreshTokenFromCookie() {
    const cookieStore = await cookies()
    return cookieStore.get('refresh_token')?.value
}

export async function getTokenFromCookie() {
    const cookieStore = await cookies()

    return cookieStore.get('token')?.value
}

export async function removeTokenFromCookie() {
    const cookieStore = await cookies()

    cookieStore.delete('token')
    cookieStore.delete('refresh_token')
}

export async function getSidebarStateFromCookie() {
    const cookieStore = await cookies()

    return cookieStore.get('sidebar_state')?.value
}

export async function handleLogout() {
    const cookieStore = await cookies()

    cookieStore.delete('token')
    cookieStore.delete('refresh_token')
    cookieStore.delete('me')

}

// ── Storefront customers ──────────────────────────────────────────────────────
// A separate cookie from the admin `token`. Keeping them apart means a customer
// session can never be mistaken for a dashboard session by the route guard, and
// the two can coexist in one browser.

export async function setCustomerTokenInCookie(token: string) {
    const cookieStore = await cookies()
    cookieStore.set('customer_token', token, cookieOptions)
}

export async function getCustomerTokenFromCookie() {
    const cookieStore = await cookies()

    return cookieStore.get('customer_token')?.value
}

export async function handleCustomerLogout() {
    const cookieStore = await cookies()

    cookieStore.delete('customer_token')
}
