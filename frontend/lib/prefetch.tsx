import { dehydrate, HydrationBoundary, QueryClient, type QueryKey } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { fetchBackend } from "@/lib/seo"

/**
 * Server-side data for the storefront's client components.
 *
 * The pages are client components that load their data with React Query, so
 * on their own the server HTML holds only skeletons. Fetching here and seeding
 * the cache under the *same keys* the components use means they render with
 * data on the server: the HTML carries the products, prices and links that
 * search engines index, and the browser skips the first round of requests.
 *
 * A key that doesn't match the component's exactly is harmless — the component
 * fetches on the client as before — so keep each one next to the hook it mirrors.
 */
export type Prefetch = {
  /** Exactly the hook's `queryKey`. */
  key: QueryKey
  /** Backend path with its query string, as the hook's fetcher requests it. */
  path: string
  /** For `useInfiniteQuery`: the response is the first page. */
  infinite?: boolean
}

const REVALIDATE = 60

/** Fetches each entry and returns the cache state to hand to the client. Failures are left out. */
export async function prefetchState(entries: Prefetch[]) {
  const client = new QueryClient()
  await Promise.all(
    entries.map(async ({ key, path, infinite }) => {
      const data = await fetchBackend<unknown>(path, REVALIDATE)
      if (data == null) return
      client.setQueryData(key, infinite ? { pages: [data], pageParams: [1] } : data)
    })
  )
  return dehydrate(client)
}

/** Renders `children` with `entries` already in the React Query cache. */
export async function Prefetched({ entries, children }: { entries: Prefetch[]; children: ReactNode }) {
  return <HydrationBoundary state={await prefetchState(entries)}>{children}</HydrationBoundary>
}

/** A query string the way axios writes `params`: undefined values left out. */
export function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ""
}
