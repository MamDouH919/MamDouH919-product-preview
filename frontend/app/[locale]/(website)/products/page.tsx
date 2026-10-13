"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useProductSearchQuery } from "@/backend-api/products/hooks"
import { ProductSort } from "@/backend-api/products/types"
import { useCategoriesQuery } from "@/backend-api/categories/hooks"
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks"
import { Category } from "@/backend-api/categories/types"
import { SubCategory } from "@/backend-api/sub-categories/types"
import { useTranslation } from "react-i18next"
import { ShoppingBag, SlidersHorizontal, X, ChevronRight, Search } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard"
import { useTheme, alpha } from "@mui/material/styles"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

interface SidebarProps {
  lang: string
  categories: Category[]
  subCategories: SubCategory[]
  catsLoading: boolean
  selectedCategoryId: string | undefined
  selectedSubCategoryId: string | undefined
  onCategorySelect: (id: string | undefined) => void
  onSubCategorySelect: (id: string | undefined) => void
  onClearFilters: () => void
  hasFilters: boolean
  minPrice: string
  maxPrice: string
  onPriceChange: (min: string, max: string) => void
  inStock: boolean
  onInStockChange: (value: boolean) => void
  t: (key: string) => string
}

/** Typed values stay local until applied, so each keystroke isn't a new search. */
function PriceFilter({
  minPrice,
  maxPrice,
  onApply,
  t,
}: {
  minPrice: string
  maxPrice: string
  onApply: (min: string, max: string) => void
  t: (key: string) => string
}) {
  const [min, setMin] = useState(minPrice)
  const [max, setMax] = useState(maxPrice)
  const [synced, setSynced] = useState({ minPrice, maxPrice })

  // Follow the URL when it changes from outside (e.g. "clear filters").
  if (synced.minPrice !== minPrice || synced.maxPrice !== maxPrice) {
    setSynced({ minPrice, maxPrice })
    setMin(minPrice)
    setMax(maxPrice)
  }

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault()
    onApply(min, max)
  }

  const input =
    "w-full min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-(--primary)"

  return (
    <form onSubmit={apply} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={() => apply()}
          placeholder={t("min")}
          aria-label={t("minPrice")}
          className={input}
        />
        <span className="text-gray-400">–</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={() => apply()}
          placeholder={t("max")}
          aria-label={t("maxPrice")}
          className={input}
        />
      </div>
    </form>
  )
}

function SidebarContent({
  lang,
  categories,
  subCategories,
  catsLoading,
  selectedCategoryId,
  selectedSubCategoryId,
  onCategorySelect,
  onSubCategorySelect,
  onClearFilters,
  hasFilters,
  minPrice,
  maxPrice,
  onPriceChange,
  inStock,
  onInStockChange,
  t,
}: SidebarProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 px-2">
        {t("categories")}
      </p>

      <button
        onClick={() => onCategorySelect(undefined)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-start w-full ${
          !selectedCategoryId ? "bg-(--primary) text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        {t("allCategories")}
      </button>

      {catsLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse mx-1 mt-1" />
          ))
        : categories.map((cat) => (
            <div key={cat._id}>
              <button
                onClick={() => onCategorySelect(cat._id)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-start w-full ${
                  selectedCategoryId === cat._id
                    ? "bg-(--primary) text-white shadow-sm"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{localized(cat.name, lang)}</span>
                {selectedCategoryId === cat._id && subCategories.length > 0 && (
                  <ChevronRight className="w-4 h-4 opacity-70 rotate-90" />
                )}
              </button>

              {selectedCategoryId === cat._id && subCategories.filter((s) => s.isActive).length > 0 && (
                <div className="ms-3 mt-1 flex flex-col gap-0.5 border-s-2 border-(--primary-20) ps-3">
                  {subCategories
                    .filter((s) => s.isActive)
                    .sort((a, b) => a.order - b.order)
                    .map((sub) => (
                      <button
                        key={sub._id}
                        onClick={() =>
                          onSubCategorySelect(selectedSubCategoryId === sub._id ? undefined : sub._id)
                        }
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-start w-full ${
                          selectedSubCategoryId === sub._id
                            ? "bg-(--primary-10) text-(--primary) font-medium"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            selectedSubCategoryId === sub._id ? "bg-(--primary)" : "bg-gray-300"
                          }`}
                        />
                        {localized(sub.name, lang)}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mt-6 mb-3 px-2">
        {t("price")}
      </p>
      <div className="px-1">
        <PriceFilter minPrice={minPrice} maxPrice={maxPrice} onApply={onPriceChange} t={t} />
      </div>

      <label className="mt-5 flex items-center gap-2.5 px-2 text-sm text-gray-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => onInStockChange(e.target.checked)}
          className="h-4 w-4 accent-(--primary)"
        />
        {t("inStockOnly")}
      </label>

      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors text-start w-full"
        >
          <X className="w-3.5 h-3.5" />
          {t("clearFilters")}
        </button>
      )}
    </div>
  )
}

const SORTS: ProductSort[] = ["featured", "newest", "price_asc", "price_desc"]

function ProductsPageContent() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // The URL is the source of truth, so a filtered view can be shared or bookmarked.
  const q = searchParams.get("q") ?? ""
  const selectedCategoryId = searchParams.get("category") ?? undefined
  const selectedSubCategoryId = searchParams.get("sub") ?? undefined
  const minPrice = searchParams.get("min") ?? ""
  const maxPrice = searchParams.get("max") ?? ""
  const inStock = searchParams.get("stock") === "1"
  const sortParam = searchParams.get("sort") as ProductSort | null
  const sort: ProductSort = sortParam && SORTS.includes(sortParam) ? sortParam : "featured"

  const setParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // The box updates instantly; the URL (and the search) follows after a pause.
  const [searchInput, setSearchInput] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  if (syncedQ !== q) {
    setSyncedQ(q)
    setSearchInput(q)
  }
  useEffect(() => {
    if (searchInput.trim() === q) return
    const timer = setTimeout(() => setParams({ q: searchInput.trim() || undefined }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const num = (v: string) => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined)
  const searchQuery = useMemo(
    () => ({
      q: q || undefined,
      categoryId: selectedCategoryId,
      subCategoryId: selectedSubCategoryId,
      minPrice: num(minPrice),
      maxPrice: num(maxPrice),
      inStock: inStock || undefined,
      sort,
      limit: 24,
    }),
    [q, selectedCategoryId, selectedSubCategoryId, minPrice, maxPrice, inStock, sort]
  )

  const { data: categories, isLoading: catsLoading } = useCategoriesQuery()
  const { data: subCategories } = useSubCategoriesQuery(selectedCategoryId)
  const {
    data,
    isLoading: productsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductSearchQuery(searchQuery)

  const products = data?.pages.flatMap((p) => p.data) ?? []
  const total = data?.pages[0]?.total ?? 0
  const activeCategories = (categories ?? []).filter((c) => c.isActive).sort((a, b) => a.order - b.order)
  const activeSubCategories = subCategories ?? []

  const hasFilters = !!(selectedCategoryId || selectedSubCategoryId || minPrice || maxPrice || inStock || q)

  const handleCategorySelect = (id: string | undefined) => setParams({ category: id, sub: undefined })

  const handleClearFilters = () => {
    setSearchInput("")
    router.replace(sort !== "featured" ? `${pathname}?sort=${sort}` : pathname, { scroll: false })
  }

  const sidebarProps: SidebarProps = {
    lang,
    categories: activeCategories,
    subCategories: activeSubCategories,
    catsLoading,
    selectedCategoryId,
    selectedSubCategoryId,
    onCategorySelect: handleCategorySelect,
    onSubCategorySelect: (id) => setParams({ sub: id }),
    onClearFilters: handleClearFilters,
    hasFilters,
    minPrice,
    maxPrice,
    onPriceChange: (min, max) => {
      if (min === minPrice && max === maxPrice) return
      setParams({ min: min || undefined, max: max || undefined })
    },
    inStock,
    onInStockChange: (value) => setParams({ stock: value ? "1" : undefined }),
    t,
  }

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--primary-10": alpha(theme.palette.primary.main, 0.1),
    "--primary-20": alpha(theme.palette.primary.main, 0.2),
    "--primary-30": alpha(theme.palette.primary.main, 0.3),
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-gray-50" style={cssVars}>
      {/* Hero */}
      <div className="bg-(--primary) text-white py-14 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
            <CustomLink href="/" className="hover:text-white transition-colors">
              {t("home")}
            </CustomLink>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            <span className="text-white">{t("products")}</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">{t("products")}</h1>
          <p className="text-white/70 text-lg">{t("browseProductsSubtitle")}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-8">
          {/* Sidebar – desktop */}
          <aside className="hidden lg:block w-60 shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <SidebarContent {...sidebarProps} />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search + sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <label className="relative flex-1">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("searchProductsPlaceholder")}
                  aria-label={t("search")}
                  maxLength={100}
                  className="w-full rounded-xl border border-gray-200 bg-white ps-10 pe-3 py-2.5 text-sm shadow-sm outline-none focus:border-(--primary)"
                />
              </label>
              <select
                value={sort}
                onChange={(e) => setParams({ sort: e.target.value === "featured" ? undefined : e.target.value })}
                aria-label={t("sortBy")}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-(--primary)"
              >
                {SORTS.map((value) => (
                  <option key={value} value={value}>
                    {t(`sort.${value}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              {!productsLoading ? (
                <p className="text-sm text-gray-500">
                  {t("productsCount", { count: total })}
                </p>
              ) : (
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              )}

              {/* Mobile filter button */}
              <button
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm hover:border-(--primary-30) transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t("filters")}
                {hasFilters && <span className="w-2 h-2 rounded-full bg-(--primary)" />}
              </button>
            </div>

            {/* Empty state */}
            {!productsLoading && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-28 gap-5 text-gray-400">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-600">{t("noProductsFound")}</p>
                  {hasFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="mt-2 text-sm text-(--primary) underline underline-offset-4"
                    >
                      {t("clearFilters")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Grid */}
            {(productsLoading || products.length > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {productsLoading
                  ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
                  : products.map((product) => (
                      <ProductCard key={product._id} product={product} lang={lang} />
                    ))}
              </div>
            )}

            {hasNextPage && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:border-(--primary) hover:text-(--primary) transition-colors disabled:opacity-60"
                >
                  {isFetchingNextPage ? t("loading") : t("loadMore")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter overlay */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative ms-auto w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-800">{t("filters")}</p>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-5">
              <SidebarContent {...sidebarProps} />
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full py-3 bg-(--primary) hover:bg-(--primary-dark) text-white rounded-xl font-medium text-sm transition-colors"
              >
                {t("viewAll")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageContent />
    </Suspense>
  )
}
