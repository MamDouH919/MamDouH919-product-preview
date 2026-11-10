import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { headers } from "next/headers"
import sharp from "sharp"
import { fetchBackend, requestBackendUrl } from "@/lib/seo"
import { withBackend } from "@/lib/getBackendUrl"
import { resolveTenantSeo } from "@/lib/tenantSeo"

const WIDTH = 1200
const HEIGHT = 630
const LOGO_BOX = 420
const BAND = 14

/**
 * The store's share image, 1200×630 JPEG: its logo centred on white, over a
 * thin band in the store's colour. For every page without its own image (home,
 * categories, products with no photo). The logo itself is square and WebP,
 * which WhatsApp, Facebook and LinkedIn crop badly or skip.
 */
export async function GET() {
  const [h, backendUrl, settings] = await Promise.all([
    headers(),
    requestBackendUrl(),
    fetchBackend<{ logo?: string; primaryColor?: string }>("/settings", 60),
  ])
  const tenant = resolveTenantSeo(h.get("x-forwarded-host") ?? h.get("host"))

  try {
    // The logo uploaded in the dashboard, else the one shipped with the tenant config.
    let logo: Buffer | undefined
    if (settings?.logo) {
      const res = await fetch(withBackend(backendUrl, settings.logo), { next: { revalidate: 3600 } })
      if (res.ok) logo = Buffer.from(await res.arrayBuffer())
    }
    logo ??= await readFile(join(process.cwd(), "public", tenant.ogImage))

    const mark = await sharp(logo)
      .rotate()
      .resize(LOGO_BOX * 2, LOGO_BOX, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer()
    const { width = LOGO_BOX, height = LOGO_BOX } = await sharp(mark).metadata()

    const color = /^#[0-9a-f]{6}$/i.test(settings?.primaryColor ?? "") ? settings!.primaryColor! : "#111111"
    const band = await sharp({ create: { width: WIDTH, height: BAND, channels: 3, background: color } }).png().toBuffer()

    const jpeg = await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#ffffff" } })
      .composite([
        { input: mark, left: Math.round((WIDTH - width) / 2), top: Math.round((HEIGHT - BAND - height) / 2) },
        { input: band, left: 0, top: HEIGHT - BAND },
      ])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
