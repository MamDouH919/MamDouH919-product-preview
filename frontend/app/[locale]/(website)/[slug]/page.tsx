import type { Metadata } from "next"
import CustomPageClient from "./_CustomPageClient"

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
    const res = await fetch(`${backendUrl}/pages/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return {}

    const page = await res.json()

    const title = loc(page.metaTitle, locale) || loc(page.title, locale)
    const rawDesc = loc(page.metaDescription, locale)
    const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + "…" : rawDesc
    const imageUrl = page.ogImage ? `${backendUrl}${page.ogImage}` : undefined

    return {
      title,
      description: description || undefined,
      robots: { index: true, follow: true },
      openGraph: {
        type: "website",
        title,
        description,
        images: imageUrl ? [{ url: imageUrl, alt: title, width: 1200, height: 630 }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
    }
  } catch {
    return {}
  }
}

export default function CustomPage({ params }: PageProps) {
  return <CustomPageClient params={params} />
}
