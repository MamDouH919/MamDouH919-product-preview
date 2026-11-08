import type { Metadata } from "next"
import { notFound } from "next/navigation"
import CategoryClient from "./_CategoryClient"
import type { Category } from "@/backend-api/categories/types"
import { fetchBackend, fetchBackendResult, metaDescription, pageMetadata, requestBackendUrl, requestOrigin } from "@/lib/seo"
import { breadcrumbLd, JsonLd } from "@/lib/jsonLd"
import type { Product } from "@/backend-api/products/types"
import { withBackend } from "@/lib/getBackendUrl"
import { loc, plainText } from "@/lib/productOffer"
import { Prefetched, query } from "@/lib/prefetch"
import { CATEGORIES_QUERY_KEY } from "@/backend-api/categories/hooks"
import { SUB_CATEGORIES_QUERY_KEY } from "@/backend-api/sub-categories/hooks"
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

// Same URL and revalidate in metadata and page, so Next makes the request once.
const getCategory = (slug: string) => fetchBackendResult<Category>(`/categories/slug/${encodeURIComponent(slug)}`, 300)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  const [result, backendUrl] = await Promise.all([getCategory(slug), requestBackendUrl()])
  if (!result.ok) return {}

  const category = result.data
  const name = loc(category.name, locale)
  const description =
    plainText(loc(category.description, locale)) ||
    (locale === "ar" ? `تسوّق منتجات ${name}: الأسعار والصور والتفاصيل.` : `Shop ${name}: prices, photos and details.`)

  return pageMetadata({
    locale,
    path: `/categories/${encodeURIComponent(slug)}`,
    title: name,
    description: metaDescription(description),
    image: category.image ? { url: withBackend(backendUrl, category.image), alt: name } : undefined,
    // A hidden category still resolves by slug for old links; keep it out of search.
    index: category.isActive,
  })
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug, locale } = await params
  // A real 404 for a category that doesn't exist; a backend hiccup still renders the page.
  const result = await getCategory(decodeURIComponent(slug))
  if (!result.ok && result.missing) notFound()

  // The keys the client's hooks use. Its slug is the raw route param, as here.
  const id = result.ok ? result.data._id : null
  const entries = id
    ? [
        { key: [CATEGORIES_QUERY_KEY, "slug", slug], path: `/categories/slug/${encodeURIComponent(decodeURIComponent(slug))}` },
        { key: [SUB_CATEGORIES_QUERY_KEY, id], path: `/sub-categories${query({ categoryId: id })}` },
        // No sub-category picked on first load.
        { key: [PRODUCTS_QUERY_KEY, { categoryId: id, subCategoryId: undefined }], path: `/products${query({ categoryId: id })}` },
      ]
    : []

  return (
    <Prefetched entries={entries}>
      {result.ok && <CategoryJsonLd category={result.data} locale={locale} />}
      <CategoryClient params={params} />
    </Prefetched>
  )
}

/** Breadcrumbs, and the category as a list of its products, so search engines see what's in it. */
async function CategoryJsonLd({ category, locale }: { category: Category; locale: string }) {
  if (!category.isActive) return null
  const [origin, products] = await Promise.all([
    requestOrigin(),
    // Same request as the prefetch above, so Next makes it once.
    fetchBackend<Product[]>(`/products${query({ categoryId: category._id })}`, 60),
  ])
  const name = loc(category.name, locale)
  const path = `/categories/${encodeURIComponent(category.slug)}`

  return (
    <JsonLd
      data={[
        breadcrumbLd(origin, locale, [
          { name: locale === "ar" ? "الأقسام" : "Categories", path: "/categories" },
          { name, path },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name,
          url: `${origin}/${locale}${path}`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: products?.length ?? 0,
            itemListElement: (products ?? []).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${origin}/${locale}/products/${encodeURIComponent(p.slug)}`,
              name: loc(p.name, locale),
            })),
          },
        },
      ]}
    />
  )
}
