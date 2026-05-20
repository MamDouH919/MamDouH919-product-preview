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
