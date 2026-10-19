"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useProductsByIdsQuery } from "@/backend-api/products/hooks"
import ProductCard from "@/components/ProductCard"
import {
  RECENTLY_VIEWED_EVENT,
  clearRecentlyViewed,
  readRecentlyViewed,
} from "./recentlyViewedStore"

/**
 * "Recently viewed" strip. Renders nothing until there's something to show,
 * so a first-time visitor never sees an empty heading. `excludeId` leaves out
 * the product the shopper is looking at right now.
 */
export default function RecentlyViewed({
  excludeId,
  max = 4,
  className = "",
}: {
  excludeId?: string
  max?: number
  /** On the section itself, so spacing disappears along with an empty strip. */
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const [ids, setIds] = useState<string[]>([])

  // Read after mount: localStorage doesn't exist on the server, and reading
  // during render would mismatch the server HTML.
  useEffect(() => {
    const refresh = () => setIds(readRecentlyViewed())
    refresh()
    window.addEventListener(RECENTLY_VIEWED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(RECENTLY_VIEWED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  // Ask for a few spare in case some were hidden or deleted since.
  const wanted = ids.filter((id) => id !== excludeId).slice(0, max + 4)
  const { data } = useProductsByIdsQuery(wanted)
  const products = (data ?? []).slice(0, max)

  if (!products.length) return null

  return (
    <section className={`flex flex-col gap-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-1 h-6 rounded-full bg-(--primary)" />
          <h2 className="text-xl font-bold text-gray-800">{t("recentlyViewed")}</h2>
        </div>
        <button
          type="button"
          onClick={clearRecentlyViewed}
          className="text-sm text-gray-400 hover:text-gray-600 underline-offset-4 hover:underline"
        >
          {t("clearHistory")}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} lang={i18n.language} />
        ))}
      </div>
    </section>
  )
}
