import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { resolveTenantSeo } from "@/lib/tenantSeo"
import ProductDetailClient from "./_ProductDetailClient"
import type { Product } from "@/backend-api/products/types"
import { fetchBackend, fetchBackendResult, isoCurrency, metaDescription, pageMetadata, requestBackendUrl, requestOrigin } from "@/lib/seo"
import { withBackend } from "@/lib/getBackendUrl"
import { Prefetched } from "@/lib/prefetch"
import { breadcrumbLd, JsonLd, returnPolicyLd, returnPolicyUrl, shippingLd, type StoreSettings } from "@/lib/jsonLd"
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks"
import { loc, plainText, productOffers, type OfferSettings } from "@/lib/productOffer"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

// Same URL and revalidate in metadata and page, so Next makes the request once.
const getProductResult = (slug: string) =>
  fetchBackendResult<Product>(`/products/slug/${encodeURIComponent(slug)}`, 60)
const getProduct = async (slug: string) => {
  const result = await getProductResult(slug)
  return result.ok ? result.data : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  const [product, origin] = await Promise.all([getProduct(slug), requestOrigin()])
  if (!product) return {}

  const name = loc(product.name, locale)
  const description = metaDescription(
    plainText(loc(product.description, locale) || loc(product.shortDescription, locale)) || name
  )
  const firstImage = product.images?.[0]
  const keywords = (product.tags ?? []) as string[]

  return {
    ...(await pageMetadata({
      locale,
      path: `/products/${encodeURIComponent(slug)}`,
      title: name,
      description,
      // Previews go through the OG route, which serves a small 1200×630 JPEG; `v`
      // changes with the image so WhatsApp and Facebook don't keep a stale one.
      image: firstImage
        ? {
            url: `${origin}/api/og/products/${encodeURIComponent(slug)}?v=${encodeURIComponent(firstImage.split("/").pop() ?? "")}`,
            width: 1200,
            height: 630,
            alt: name,
          }
        : undefined,
      // A hidden product still resolves by slug for old links; keep it out of search.
      index: product.isActive,
    })),
    keywords: keywords.join(", ") || undefined,
  }
}

/** schema.org Product + BreadcrumbList, so search results can show price, stock and stars. */
async function ProductJsonLd({ slug, locale }: { slug: string; locale: string }) {
  const [product, settings, origin, backendUrl, h, navPages] = await Promise.all([
    getProduct(slug),
    fetchBackend<OfferSettings & StoreSettings>("/settings", 60),
    requestOrigin(),
    requestBackendUrl(),
    headers(),
    fetchBackend<{ slug: string }[]>("/pages/navigation", 60),
  ])
  if (!product || !product.isActive) return null

  const url = `${origin}/${locale}/products/${encodeURIComponent(slug)}`
  const name = loc(product.name, locale)
  const currency = isoCurrency(settings)

  // One offer per variant, priced and stocked exactly as the feed and checkout do.
  // Zero is "no price" (older variants were saved with 0), as in the feed.
  const list = currency ? productOffers(product, settings).filter((o) => o.price > 0) : []
  const offerLd = (o: (typeof list)[number]) => ({
    "@type": "Offer",
    priceCurrency: currency,
    price: o.price,
    availability: `https://schema.org/${o.inStock ? "InStock" : "OutOfStock"}`,
    itemCondition: "https://schema.org/NewCondition",
    sku: o.sku,
    gtin: o.gtin,
    name: o.label,
    // A sale: the old price, struck through, alongside the selling one.
    priceSpecification: o.compareAtPrice
      ? {
          "@type": "UnitPriceSpecification",
          priceType: "https://schema.org/StrikethroughPrice",
          price: o.compareAtPrice,
          priceCurrency: currency,
        }
      : undefined,
    url: o.variantId ? `${url}?variant=${o.variantId}` : url,
    shippingDetails,
    hasMerchantReturnPolicy,
  })
  const prices = list.map((o) => o.price)
  // Shipping and returns are the store's, the same for every offer.
  const shippingDetails = shippingLd(settings, currency)
  const hasMerchantReturnPolicy = returnPolicyLd(settings, returnPolicyUrl(origin, locale, navPages))

  // No offer at all rather than one with a guessed currency.
  const offers = !list.length
    ? undefined
    : list.length === 1
      ? offerLd(list[0])
      : {
          "@type": "AggregateOffer",
          priceCurrency: currency,
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: list.length,
          offers: list.map(offerLd),
        }

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description:
      plainText(loc(product.description, locale) || loc(product.shortDescription, locale)).slice(0, 5000) || undefined,
    // Left out, not empty, when there are none: Google flags an empty list as an error.
    image: product.images?.length ? product.images.map((img) => withBackend(backendUrl, img)) : undefined,
    sku: product.sku || undefined,
    // The store sells its own goods under its name; the feed says the same.
    brand: {
      "@type": "Brand",
      name: product.brand?.trim() || resolveTenantSeo(h.get("x-forwarded-host") ?? h.get("host")).siteName,
    },
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

  // Home → its category → the product: the path a shopper takes, shown in results.
  const category = product.category
  const crumbs = category?.slug
    ? [{ name: loc(category.name, locale), path: `/categories/${encodeURIComponent(category.slug)}` }]
    : [{ name: locale === "ar" ? "المنتجات" : "Products", path: "/products" }]

  return (
    <JsonLd
      data={[
        productLd,
        breadcrumbLd(origin, locale, [...crumbs, { name, path: `/products/${encodeURIComponent(slug)}` }]),
      ]}
    />
  )
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug: rawSlug, locale } = await params
  // A real 404 for a product that doesn't exist; a backend hiccup still renders the page.
  const slug = decodeURIComponent(rawSlug)
  const result = await getProductResult(slug)
  if (!result.ok && result.missing) notFound()

  // The keys useProductBySlugQuery and useRelatedProductsQuery(id, 4) use.
  const product = result.ok ? result.data : null
  const entries = product
    ? [
        { key: [PRODUCTS_QUERY_KEY, "slug", slug], path: `/products/slug/${encodeURIComponent(slug)}` },
        { key: [PRODUCTS_QUERY_KEY, "related", product._id, 4], path: `/products/${product._id}/related?limit=4` },
      ]
    : []

  return (
    <>
      <ProductJsonLd slug={decodeURIComponent(rawSlug)} locale={locale} />
      <Prefetched entries={entries}>
        <ProductDetailClient params={params} />
      </Prefetched>
    </>
  )
}
