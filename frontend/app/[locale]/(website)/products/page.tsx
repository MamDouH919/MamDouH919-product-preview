"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useProductSearchQuery } from "@/backend-api/products/hooks"
import { ProductSort } from "@/backend-api/products/types"
import { useCategoriesQuery } from "@/backend-api/categories/hooks"
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks"
import { Category } from "@/backend-api/categories/types"
import { useTranslation } from "react-i18next"
import { ShoppingBag, SlidersHorizontal, X, ChevronRight, Search, LayoutGrid, ArrowUpDown } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard"
import { getBackendUri } from "@/utils/helperFunctions"
import { useStoreModules } from "@/Hooks/useStoreModules"
import { useCurrency } from "@/Hooks/useCurrency"
import { useTheme, alpha } from "@mui/material/styles"
import Image from "next/image"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

type T = (key: string, options?: Record<string, unknown>) => string

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
  t: T
}) {
  const currency = useCurrency()
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

  const field = (value: string, setValue: (v: string) => void, placeholder: string, label: string) => (
    <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50/60 px-3 transition-colors focus-within:border-(--primary) focus-within:bg-white">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => apply()}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full min-w-0 bg-transparent text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {currency && <span className="shrink-0 text-xs text-gray-400">{currency}</span>}
    </label>
  )

  return (
    <form onSubmit={apply} className="flex items-center gap-2">
      {field(min, setMin, t("min"), t("minPrice"))}
      <span className="text-gray-300">—</span>
      {field(max, setMax, t("max"), t("maxPrice"))}
      {/* Enter applies; blur applies too, so no visible button is needed. */}
      <button type="submit" className="sr-only">
        {t("apply")}
      </button>
    </form>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer select-none items-center justify-between gap-3 text-sm text-gray-700">
      {label}
      <span className="relative inline-flex">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-(--primary) peer-focus-visible:ring-2 peer-focus-visible:ring-(--primary-30)" />
        <span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all peer-checked:start-5.5" />
      </span>
    </label>
  )
}

interface FilterPanelProps {
  minPrice: string
  maxPrice: string
  onPriceChange: (min: string, max: string) => void
  inStock: boolean
  onInStockChange: (value: boolean) => void
  /** Off when the store hides prices or keeps no stock; the filter would mean nothing. */
  showPrice: boolean
  showStock: boolean
  t: T
}

function FilterPanel({ minPrice, maxPrice, onPriceChange, inStock, onInStockChange, showPrice, showStock, t }: FilterPanelProps) {
  return (
    <div className="flex flex-col divide-y divide-gray-100">
      {showPrice && (
        <section className="pb-5 last:pb-0">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("price")}</h3>
          <PriceFilter minPrice={minPrice} maxPrice={maxPrice} onApply={onPriceChange} t={t} />
        </section>
      )}
      {showStock && (
        <section className="pt-5 first:pt-0">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("availability")}</h3>
          <Toggle checked={inStock} onChange={onInStockChange} label={t("inStockOnly")} />
        </section>
      )}
    </div>
  )
}

function CategoryStrip({
  lang,
  categories,
  loading,
  selectedId,
  onSelect,
  t,
}: {
  lang: string
  categories: Category[]
  loading: boolean
  selectedId: string | undefined
  onSelect: (id: string | undefined) => void
  t: T
}) {
  const pill = (active: boolean) =>
    `flex h-11 shrink-0 items-center gap-2 rounded-full border ps-1.5 pe-4 text-sm font-medium transition-all ${
      active
        ? "border-(--primary) bg-(--primary) text-white shadow-[0_8px_20px_-10px_var(--primary)]"
        : "border-gray-200 bg-white text-gray-700 hover:border-(--primary-30) hover:text-(--primary)"
    }`

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button type="button" onClick={() => onSelect(undefined)} className={pill(!selectedId)} aria-pressed={!selectedId}>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            !selectedId ? "bg-white/20" : "bg-(--primary-10) text-(--primary)"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </span>
        {t("allCategories")}
      </button>

      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 w-32 shrink-0 animate-pulse rounded-full bg-gray-200/70" />
          ))
        : categories.map((cat) => {
            const active = selectedId === cat._id
            const name = localized(cat.name, lang)
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => onSelect(active ? undefined : cat._id)}
                className={pill(active)}
                aria-pressed={active}
              >
                <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                  {cat.image ? (
                    <Image src={getBackendUri(cat.image)} alt="" fill sizes="32px" className="object-cover" />
                  ) : (
                    name.charAt(0).toUpperCase()
                  )}
                </span>
                {name}
              </button>
            )
          })}
    </div>
  )
}

const SORTS: ProductSort[] = ["featured", "newest", "price_asc", "price_desc"]
const UNPRICED_SORTS: ProductSort[] = ["featured", "newest"]

function ProductsPageContent() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currency = useCurrency()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const { has, showPrices } = useStoreModules()
  const showStock = has("inventory")
  const hasFilterPanel = showPrices || showStock
  const sorts = showPrices ? SORTS : UNPRICED_SORTS

  // The URL is the source of truth, so a filtered view can be shared or bookmarked.
  const q = searchParams.get("q") ?? ""
  const selectedCategoryId = searchParams.get("category") ?? undefined
  const selectedSubCategoryId = searchParams.get("sub") ?? undefined
  // A filter the store doesn't offer is ignored, even in an old shared link.
  const minPrice = showPrices ? searchParams.get("min") ?? "" : ""
  const maxPrice = showPrices ? searchParams.get("max") ?? "" : ""
  const inStock = showStock && searchParams.get("stock") === "1"
  const sortParam = searchParams.get("sort") as ProductSort | null
  const sort: ProductSort = sortParam && sorts.includes(sortParam) ? sortParam : "featured"

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

  // Lock page scroll behind the mobile filter sheet.
  useEffect(() => {
    if (!mobileFilterOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileFilterOpen])

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
  const activeSubCategories = selectedCategoryId
    ? (subCategories ?? []).filter((s) => s.isActive).sort((a, b) => a.order - b.order)
    : []
  const selectedCategory = activeCategories.find((c) => c._id === selectedCategoryId)
  const selectedSubCategory = activeSubCategories.find((s) => s._id === selectedSubCategoryId)

  const hasFilters = !!(selectedCategoryId || selectedSubCategoryId || minPrice || maxPrice || inStock || q)
  const panelFilterCount = (minPrice || maxPrice ? 1 : 0) + (inStock ? 1 : 0)

  const handleClearFilters = () => {
    setSearchInput("")
    router.replace(sort !== "featured" ? `${pathname}?sort=${sort}` : pathname, { scroll: false })
  }

  const filterPanelProps: FilterPanelProps = {
    minPrice,
    maxPrice,
    onPriceChange: (min, max) => {
      if (min === minPrice && max === maxPrice) return
      setParams({ min: min || undefined, max: max || undefined })
    },
    inStock,
    onInStockChange: (value) => setParams({ stock: value ? "1" : undefined }),
    showPrice: showPrices,
    showStock,
    t,
  }

  // Removable chips for everything currently narrowing the results.
  const priceLabel =
    minPrice && maxPrice ? `${minPrice} – ${maxPrice}` : minPrice ? `≥ ${minPrice}` : maxPrice ? `≤ ${maxPrice}` : ""
  const chips = [
    q && { key: "q", label: `“${q}”`, onRemove: () => setSearchInput("") },
    selectedCategory && {
      key: "category",
      label: localized(selectedCategory.name, lang),
      onRemove: () => setParams({ category: undefined, sub: undefined }),
    },
    selectedSubCategory && {
      key: "sub",
      label: localized(selectedSubCategory.name, lang),
      onRemove: () => setParams({ sub: undefined }),
    },
    priceLabel && {
      key: "price",
      label: `${t("price")}: ${priceLabel}${currency ? ` ${currency}` : ""}`,
      onRemove: () => setParams({ min: undefined, max: undefined }),
    },
    inStock && { key: "stock", label: t("inStockOnly"), onRemove: () => setParams({ stock: undefined }) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[]

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--primary-10": alpha(theme.palette.primary.main, 0.1),
    "--primary-20": alpha(theme.palette.primary.main, 0.2),
    "--primary-30": alpha(theme.palette.primary.main, 0.3),
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-[#f7f7f8]" style={cssVars}>
      {/* Hero */}
      <header className="relative overflow-hidden bg-(--primary) text-white">
        {/* Decorative glow and grid, purely visual */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 end-[-10%] h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 start-[-5%] h-80 w-80 rounded-full bg-black/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 md:pb-20 md:pt-14">
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-white/60" aria-label="Breadcrumb">
            <CustomLink href="/" className="transition-colors hover:text-white">
              {t("home")}
            </CustomLink>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="text-white">{t("products")}</span>
          </nav>

          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t("products")}</h1>
            <p className="mt-3 text-base text-white/75 md:text-lg">{t("browseProductsSubtitle")}</p>
          </div>

          <label className="relative mt-8 block max-w-2xl">
            <Search className="pointer-events-none absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchProductsPlaceholder")}
              aria-label={t("search")}
              maxLength={100}
              className="h-14 w-full rounded-2xl bg-white pe-12 ps-14 text-base text-gray-900 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.45)] outline-none ring-4 ring-transparent transition placeholder:text-gray-400 focus:ring-white/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label={t("clearFilters")}
                className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>
      </header>

      <div className="relative mx-auto -mt-7 max-w-7xl px-4 pb-16">
        {/* Categories */}
        <div className="rounded-2xl bg-white p-3 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)] ring-1 ring-black/5">
          <CategoryStrip
            lang={lang}
            categories={activeCategories}
            loading={catsLoading}
            selectedId={selectedCategoryId}
            onSelect={(id) => setParams({ category: id, sub: undefined })}
            t={t}
          />

          {activeSubCategories.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto border-t border-gray-100 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeSubCategories.map((sub) => {
                const active = selectedSubCategoryId === sub._id
                return (
                  <button
                    key={sub._id}
                    type="button"
                    onClick={() => setParams({ sub: active ? undefined : sub._id })}
                    aria-pressed={active}
                    className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-(--primary-10) text-(--primary) ring-1 ring-(--primary-30)"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {localized(sub.name, lang)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-8">
          {/* Filters – desktop */}
          <aside className={hasFilterPanel ? "hidden w-64 shrink-0 lg:block" : "hidden"}>
            <div className="sticky top-24 rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <SlidersHorizontal className="h-4 w-4 text-(--primary)" />
                  {t("filters")}
                </h2>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs font-medium text-gray-500 underline-offset-4 hover:text-(--primary) hover:underline"
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>
              <FilterPanel {...filterPanelProps} />
            </div>
          </aside>

          {/* Results */}
          <main className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {productsLoading ? (
                <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
              ) : (
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{t("productsCount", { count: total })}</span>
                  {q && <span> {t("resultsFor", { q })}</span>}
                </p>
              )}

              <div className="flex items-center gap-2">
                {hasFilterPanel && (
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(true)}
                    className="relative flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-sm font-medium text-gray-700 ring-1 ring-black/10 transition hover:ring-(--primary-30) lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {t("filters")}
                    {panelFilterCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-(--primary) px-1 text-[11px] font-semibold text-white">
                        {panelFilterCount}
                      </span>
                    )}
                  </button>
                )}

                <label className="relative flex h-10 items-center rounded-xl bg-white ring-1 ring-black/10 transition focus-within:ring-(--primary)">
                  <ArrowUpDown className="pointer-events-none absolute start-3 h-4 w-4 text-gray-400" />
                  <select
                    value={sort}
                    onChange={(e) =>
                      setParams({ sort: e.target.value === "featured" ? undefined : e.target.value })
                    }
                    aria-label={t("sortBy")}
                    className="h-full cursor-pointer appearance-none rounded-xl bg-transparent pe-9 ps-9 text-sm font-medium text-gray-700 outline-none"
                  >
                    {sorts.map((value) => (
                      <option key={value} value={value}>
                        {t(`sort.${value}`)}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute end-3 h-4 w-4 rotate-90 text-gray-400" />
                </label>
              </div>
            </div>

            {chips.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-white pe-1 ps-3 text-[13px] font-medium text-gray-700 ring-1 ring-black/10"
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`${t("clearFilters")}: ${chip.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {chips.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="h-8 px-2 text-[13px] font-medium text-(--primary) hover:underline"
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}

            {/* Empty state */}
            {!productsLoading && products.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white px-6 py-24 text-center ring-1 ring-black/5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-(--primary-10)">
                  <ShoppingBag className="h-9 w-9 text-(--primary)" strokeWidth={1.5} />
                </div>
                <p className="text-lg font-semibold text-gray-800">{t("noProductsFound")}</p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-xl bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary-dark)"
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}

            {/* Grid */}
            {(productsLoading || products.length > 0) && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {productsLoading
                  ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
                  : products.map((product) => <ProductCard key={product._id} product={product} lang={lang} />)}
              </div>
            )}

            {hasNextPage && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-xs text-gray-400">
                  {products.length} / {total}
                </p>
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-gray-800 ring-1 ring-black/10 transition hover:text-(--primary) hover:ring-(--primary) disabled:opacity-60"
                >
                  {isFetchingNextPage ? t("loading") : t("loadMore")}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-gray-200" />
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <p className="text-lg font-semibold text-gray-900">{t("filters")}</p>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                aria-label={t("close")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <FilterPanel {...filterPanelProps} />
            </div>
            <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
              {hasFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-12 rounded-xl px-4 text-sm font-medium text-gray-600 ring-1 ring-black/10"
                >
                  {t("clearFilters")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="h-12 flex-1 rounded-xl bg-(--primary) text-sm font-semibold text-white transition-colors hover:bg-(--primary-dark)"
              >
                {t("showResults")}
                {!productsLoading && ` (${total})`}
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
