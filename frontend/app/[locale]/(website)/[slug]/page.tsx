import type { Metadata } from "next"
import { notFound } from "next/navigation"
import CustomPageClient from "./_CustomPageClient"
import { withBackend } from "@/lib/getBackendUrl"
import { fetchBackendResult, metaDescription, pageMetadata, requestBackendUrl } from "@/lib/seo"
import { loc } from "@/lib/productOffer"
import { Prefetched } from "@/lib/prefetch"
import { PAGES_QUERY_KEY } from "@/backend-api/pages/hooks"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

type PublicPage = {
  title?: Record<string, string | undefined>
  metaTitle?: Record<string, string | undefined>
  metaDescription?: Record<string, string | undefined>
  ogImage?: string
}

// Same URL and revalidate in metadata and page, so Next makes the request once.
// Only published pages resolve; a draft answers 404 like a page that never existed.
const getPage = (slug: string) => fetchBackendResult<PublicPage>(`/pages/slug/${encodeURIComponent(slug)}`, 60)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  // Resolved from the request host: the env override is unset in production,
  // which left every custom page without a title or description.
  const [result, backendUrl] = await Promise.all([getPage(slug), requestBackendUrl()])
  if (!result.ok) return {}

  const page = result.data
  const title = loc(page.metaTitle, locale) || loc(page.title, locale)

  return pageMetadata({
    locale,
    path: `/${encodeURIComponent(slug)}`,
    title,
    description: metaDescription(loc(page.metaDescription, locale)) || undefined,
    image: page.ogImage ? { url: withBackend(backendUrl, page.ogImage), width: 1200, height: 630, alt: title } : undefined,
  })
}

export default async function CustomPage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug)
  // Every unknown one-segment URL lands here, so this is the site's 404 for them.
  const result = await getPage(slug)
  if (!result.ok && result.missing) notFound()

  return (
    <Prefetched entries={result.ok ? [{ key: [PAGES_QUERY_KEY, "slug", slug], path: `/pages/slug/${encodeURIComponent(slug)}` }] : []}>
      <CustomPageClient params={params} />
    </Prefetched>
  )
}
