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

export async function setTokenInCookie(token: string) {
    const cookieStore = await cookies()
    cookieStore.set('token', token, cookieOptions)
}

export async function getTokenFromCookie() {
    const cookieStore = await cookies()

    return cookieStore.get('token')?.value
}

export async function removeTokenFromCookie() {
    const cookieStore = await cookies()

    cookieStore.delete('token')
}

export async function getSidebarStateFromCookie() {
    const cookieStore = await cookies()

    return cookieStore.get('sidebar_state')?.value
}

export async function handleLogout() {
    const cookieStore = await cookies()

    cookieStore.delete('token')
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
