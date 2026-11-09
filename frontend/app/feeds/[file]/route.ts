import { headers } from "next/headers"
import { fetchBackend, isoCurrency, LOCALES, requestBackendUrl, requestOrigin } from "@/lib/seo"
import { resolveTenantSeo } from "@/lib/tenantSeo"
import { buildGoogleFeed, feedImageUrls, type FeedProduct, type FeedSettings } from "@/lib/merchantFeed"

/**
 * Google Merchant Center product feed, one per language:
 *   /feeds/google-ar.xml, /feeds/google-en.xml
 * Per tenant, like the sitemap: the request host decides the store.
 * Register each URL in Merchant Center as a scheduled fetch (daily).
 */

const FILE = /^google-([a-z]{2})\.xml$/

/** Whether an image answers 200 with an image type. Cached like the feed itself. */
async function imageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } })
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")
  } catch {
    // A timeout is not proof the image is gone; keep it rather than drop the product.
    return true
  }
}

/**
 * Images stored as backend paths ("/uploads/...") predate R2, and some of
 * those files no longer exist. Check only those: R2 URLs are written on upload.
 */
async function brokenLegacyImages(products: FeedProduct[], backendUrl: string): Promise<Set<string>> {
  const legacy = [
    ...new Set(
      products.flatMap((p) => feedImageUrls({ images: p.images?.filter((img) => !/^https?:\/\//i.test(img)) }, backendUrl)),
    ),
  ]
  const results = await Promise.all(legacy.map(async (url) => [url, await imageLoads(url)] as const))
  return new Set(results.filter(([, ok]) => !ok).map(([url]) => url))
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const locale = FILE.exec((await params).file)?.[1]
  if (!locale || !LOCALES.includes(locale)) return new Response("Not found", { status: 404 })

  const [origin, backendUrl, h, products, settings] = await Promise.all([
    requestOrigin(),
    requestBackendUrl(),
    headers(),
    fetchBackend<FeedProduct[]>("/feed/products", 900),
    fetchBackend<FeedSettings>("/settings", 300),
  ])

  // Never answer with an empty feed when the backend is down: Merchant Center
  // would take that as "every product was removed" and delist the whole store.
  if (!products || !settings) return new Response("Feed temporarily unavailable", { status: 503 })

  const currency = isoCurrency(settings)
  if (!currency) return new Response("Store currency is not set", { status: 503 })

  const tenant = resolveTenantSeo(h.get("x-forwarded-host") ?? h.get("host"))
  const seo = tenant[locale === "ar" ? "ar" : "en"]

  const brokenImages = await brokenLegacyImages(products, backendUrl)
  const skipped: string[] = []

  const xml = buildGoogleFeed(products, settings, {
    locale,
    currency,
    origin,
    backendUrl,
    storeName: tenant.siteName,
    title: seo.title,
    description: seo.description,
    brokenImages,
    onSkip: (id, reason) => skipped.push(`${id}: ${reason}`),
  })

  if (skipped.length) {
    console.warn(`[feed] ${tenant.siteName} google-${locale}.xml skipped ${skipped.length} product(s):\n  ${skipped.join("\n  ")}`)
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  })
}
