import type { Metadata } from "next"
import ProductsClient from "./_ProductsClient"
import { pageMetadata, requestOrigin } from "@/lib/seo"
import { breadcrumbLd, JsonLd } from "@/lib/jsonLd"
import { Prefetched, query } from "@/lib/prefetch"
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks"

const COPY = {
  ar: {
    title: "كل المنتجات",
    description: "كل منتجاتنا في مكان واحد: الأسعار والصور والتفاصيل. تصفّح حسب القسم ورتّب بالسعر أو الأحدث واطلب بسهولة.",
  },
  en: {
    title: "All products",
    description: "Every product in one place, with prices, photos and details. Browse by category, sort by price or newest, and order easily.",
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const copy = COPY[locale === "ar" ? "ar" : "en"]
  // Filters and search live in the query string; the canonical leaves it out.
  return pageMetadata({ locale, path: "/products", ...copy })
}

/** The unfiltered first page, as useProductSearchQuery asks for it with no filters in the URL. */
const FIRST_PAGE = { sort: "featured", limit: 24 } as const

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale }, origin] = await Promise.all([params, requestOrigin()])
  // Filtered views are canonicalised to this page, so only the plain list is
  // rendered on the server; with filters the client fetches as before.
  const filtered = Object.keys(await searchParams).length > 0
  const entries = filtered
    ? []
    : [{ key: [PRODUCTS_QUERY_KEY, "search", FIRST_PAGE], path: `/products/search${query({ ...FIRST_PAGE, page: 1 })}`, infinite: true }]

  return (
    <Prefetched entries={entries}>
      <JsonLd data={breadcrumbLd(origin, locale, [{ name: COPY[locale === "ar" ? "ar" : "en"].title, path: "/products" }])} />
      <ProductsClient />
    </Prefetched>
  )
}
