import type { Metadata } from "next"
import ProductDetailClient from "./_ProductDetailClient"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

function loc(field: Record<string, string | undefined> | undefined, locale: string): string {
  if (!field) return ""
  return field[locale] || field["ar"] || field["en"] || ""
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? ""

  try {
    const res = await fetch(`${backendUrl}/products/slug/${slug}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return {}

    const product = await res.json()

    const name = loc(product.name, locale)
    const rawDesc = loc(product.description, locale) || loc(product.shortDescription, locale)
    const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + "…" : rawDesc
    const imageUrl = product.images?.[0] ? `${backendUrl}${product.images[0]}` : undefined
    const keywords = (product.tags ?? []) as string[]

    const ogImage = imageUrl
      ? [{ url: imageUrl, alt: name, width: 1200, height: 630 }]
      : []

    return {
      title: name,
      description,
      keywords: keywords.join(", "),
      robots: { index: true, follow: true },
      openGraph: {
        type: "website",
        title: name,
        description,
        images: ogImage,
      },
      twitter: {
        card: "summary_large_image",
        title: name,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
    }
  } catch {
    return {}
  }
}

export default function ProductDetailPage({ params }: PageProps) {
  return <ProductDetailClient params={params} />
}
