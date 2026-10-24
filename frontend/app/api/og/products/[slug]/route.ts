import sharp from "sharp"
import type { Product } from "@/backend-api/products/types"
import { fetchBackend, requestBackendUrl } from "@/lib/seo"
import { withBackend } from "@/lib/getBackendUrl"

/**
 * The product's first image as a 1200×630 JPEG for link previews.
 * Stored images can be multi-megabyte or WebP, and WhatsApp, Facebook and
 * LinkedIn drop previews for those, so shares showed no image.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug)
  const [product, backendUrl] = await Promise.all([
    fetchBackend<Product>(`/products/slug/${encodeURIComponent(slug)}`, 60),
    requestBackendUrl(),
  ])
  const image = product?.images?.[0]
  if (!image) return new Response("Not found", { status: 404 })

  try {
    const res = await fetch(withBackend(backendUrl, image), { next: { revalidate: 3600 } })
    if (!res.ok) return new Response("Not found", { status: 404 })

    // Contain on white rather than crop, so the product is never cut off.
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize(1200, 630, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
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
