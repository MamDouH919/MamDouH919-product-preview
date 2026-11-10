/**
 * The store's social links, as the dashboard saves them in `settings.socialMedia`.
 * Shared by the dashboard form, the footer and contact page, and the
 * Organization `sameAs` in the structured data, so all of them read a link the same way.
 */

/** Networks the dashboard offers. Each one only appears on the site once the store adds its link. */
export const SOCIAL_KEYS = [
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
  "LINKEDIN",
  "SNAPCHAT",
  "TELEGRAM",
  "WHATSAPP",
] as const

/** Keys saved under an older name: "TWITTER" was the dashboard's name for X. */
const KEY_ALIASES: Record<string, string> = { TWITTER: "X" }

export function normalizeSocialKey(key?: string) {
  const upper = (key ?? "").trim().toUpperCase()
  return KEY_ALIASES[upper] ?? upper
}

/** The link, if it is a web address. Anything else (`javascript:`, a bare handle) is dropped. */
export function safeSocialUrl(value?: string) {
  const url = value?.trim()
  return url && /^https?:\/\//i.test(url) ? url : undefined
}

/**
 * A Facebook "share" link (facebook.com/share/…, fb.me/…) opens a post or a
 * redirect, not the page itself. Search engines can't tie it to the store, so
 * the dashboard warns about it and `sameAs` leaves it out.
 */
export function isShareLink(value?: string) {
  return /^https?:\/\/((www|m|web)\.)?(facebook\.com\/share\/|fb\.me\/)/i.test(value?.trim() ?? "")
}

/**
 * A link as the store's profile for `sameAs`: its tracking parameters removed
 * (Instagram's `?igsh=`, TikTok's `?_t=`), so it is the profile's own address.
 * Undefined for links that aren't a profile: WhatsApp (a phone number, already
 * the store's `telephone`) and Facebook share links.
 */
export function profileUrl(key: string | undefined, value: string | undefined) {
  const url = safeSocialUrl(value)
  if (!url || normalizeSocialKey(key) === "WHATSAPP" || isShareLink(url)) return undefined
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(url)) return undefined
  try {
    const parsed = new URL(url)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return undefined
  }
}
