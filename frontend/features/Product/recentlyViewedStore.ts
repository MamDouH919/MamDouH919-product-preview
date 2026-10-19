/**
 * Products this browser opened, newest first. Kept in localStorage — per
 * origin, so per tenant — and never sent anywhere except to look the products
 * up again.
 */
const STORAGE_KEY = "recently-viewed";
const LIMIT = 12;
/** Fired on this window whenever the list changes, so every strip on the page refreshes. */
export const RECENTLY_VIEWED_EVENT = "recently-viewed-change";

export function readRecentlyViewed(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full storage — the strip just stays empty.
  }
  window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT));
}

export function recordRecentlyViewed(productId: string) {
  const ids = readRecentlyViewed();
  if (ids[0] === productId) return;
  write([productId, ...ids.filter((id) => id !== productId)].slice(0, LIMIT));
}

export function clearRecentlyViewed() {
  write([]);
}
