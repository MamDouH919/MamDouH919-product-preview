import type { Metadata } from "next"
import ProductDetailClient from "./_ProductDetailClient"
import type { Product } from "@/backend-api/products/types"
import { fetchBackend, isoCurrency, languageAlternates, requestBackendUrl, requestOrigin } from "@/lib/seo"
import { withBackend } from "@/lib/getBackendUrl"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

function loc(field: Record<string, string | undefined> | undefined, locale: string): string {
  if (!field) return ""
  return field[locale] || field["ar"] || field["en"] || ""
}

/** Descriptions are rich text; structured data and meta tags want plain text. */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

// Same URL and revalidate in metadata and page, so Next makes the request once.
const getProduct = (slug: string) => fetchBackend<Product>(`/products/slug/${encodeURIComponent(slug)}`, 60)

type PublicSettings = { currency?: Record<string, string | undefined>; country?: string }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  const [product, origin, backendUrl] = await Promise.all([getProduct(slug), requestOrigin(), requestBackendUrl()])
  if (!product) return {}

  const path = `/products/${encodeURIComponent(slug)}`
  const name = loc(product.name, locale)
  const rawDesc = plainText(loc(product.description, locale) || loc(product.shortDescription, locale))
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + "…" : rawDesc
  const imageUrl = product.images?.[0] ? withBackend(backendUrl, product.images[0]) : undefined
  const keywords = (product.tags ?? []) as string[]

  const ogImage = imageUrl
    ? [{ url: imageUrl, alt: name, width: 1200, height: 630 }]
    : []

  return {
    title: name,
    description,
    keywords: keywords.join(", "),
    // A hidden product still resolves by slug for old links; keep it out of search.
    robots: { index: product.isActive, follow: true },
    alternates: {
      canonical: `${origin}/${locale}${path}`,
      languages: languageAlternates(origin, path),
    },
    openGraph: {
      type: "website",
      url: `${origin}/${locale}${path}`,
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
}

/** schema.org Product + BreadcrumbList, so search results can show price, stock and stars. */
async function ProductJsonLd({ slug, locale }: { slug: string; locale: string }) {
  const [product, settings, origin, backendUrl] = await Promise.all([
    getProduct(slug),
    fetchBackend<PublicSettings>("/settings", 300),
    requestOrigin(),
    requestBackendUrl(),
  ])
  if (!product || !product.isActive) return null

  const url = `${origin}/${locale}/products/${encodeURIComponent(slug)}`
  const name = loc(product.name, locale)
  const currency = isoCurrency(settings)

  const variantPrices = (product.variants ?? []).map((v) => v.price).filter((p): p is number => p != null)
  const prices = variantPrices.length ? variantPrices : product.price != null ? [product.price] : []
  const stock = product.totalStock ?? product.stock ?? 0
  const inStock = !product.trackStock || product.allowBackorder || stock > 0
  const availability = `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`

  // No offer at all rather than one with a guessed currency.
  const offers =
    currency && prices.length
      ? prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
        ? {
            "@type": "AggregateOffer",
            priceCurrency: currency,
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: prices.length,
            availability,
            url,
          }
        : { "@type": "Offer", priceCurrency: currency, price: prices[0], availability, url }
      : undefined

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: plainText(loc(product.description, locale) || loc(product.shortDescription, locale)) || undefined,
    image: (product.images ?? []).map((img) => withBackend(backendUrl, img)),
    sku: product.sku || undefined,
    category: loc(product.category?.name, locale) || undefined,
    url,
    offers,
    aggregateRating: product.ratingCount
      ? {
          "@type": "AggregateRating",
          ratingValue: product.ratingAverage,
          reviewCount: product.ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: locale === "ar" ? "الرئيسية" : "Home", item: `${origin}/${locale}` },
      {
        "@type": "ListItem",
        position: 2,
        name: locale === "ar" ? "المنتجات" : "Products",
        item: `${origin}/${locale}/products`,
      },
      { "@type": "ListItem", position: 3, name, item: url },
    ],
  }

  // Escape "<" so text from the catalogue can never close the script tag.
  const json = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c")

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(breadcrumbLd) }} />
    </>
  )
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug: rawSlug, locale } = await params

  return (
    <>
      <ProductJsonLd slug={decodeURIComponent(rawSlug)} locale={locale} />
      <ProductDetailClient params={params} />
    </>
  )
}
