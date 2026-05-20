"use client"

import { useState } from "react"
import { useProductsQuery } from "@/backend-api/products/hooks"
import { useCategoriesQuery } from "@/backend-api/categories/hooks"
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks"
import { Product } from "@/backend-api/products/types"
import { Category } from "@/backend-api/categories/types"
import { SubCategory } from "@/backend-api/sub-categories/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import { ShoppingBag, SlidersHorizontal, X, ChevronRight } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import Image from "next/image"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

function ProductCard({ product, lang }: { product: Product; lang: string }) {
  const name = localized(product.name, lang)
  const categoryName = localized(product.category?.name, lang)
  const image = product.images?.[0]

  return (
    <CustomLink
      href={`/products/${product.slug}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-[#004842]/25 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        {image ? (
          <Image
            src={getBackendUri(image)}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-100">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {categoryName && (
          <span className="absolute top-2.5 inset-s-2.5 text-[10px] font-semibold uppercase tracking-wide bg-white/90 backdrop-blur-sm text-[#004842] px-2 py-0.5 rounded-full shadow-sm">
            {categoryName}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
      </div>

      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug flex-1">{name}</p>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
          {product.price != null ? (
            <span className="text-base font-bold text-[#004842]">{product.price.toLocaleString()}</span>
          ) : (
            <span />
          )}
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#004842]/8 group-hover:bg-[#004842] transition-colors duration-300">
            <ShoppingBag className="w-4 h-4 text-[#004842] group-hover:text-white transition-colors duration-300" />
          </span>
        </div>
      </div>
    </CustomLink>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="flex flex-col gap-3 p-3">
        <div className="h-4 w-4/5 bg-gray-200 rounded-lg" />
        <div className="h-3 w-3/5 bg-gray-200 rounded-lg" />
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="h-5 w-1/4 bg-gray-200 rounded-lg" />
          <div className="w-8 h-8 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  )
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
  t: (key: string) => string
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
          !selectedCategoryId ? "bg-[#004842] text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
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
                    ? "bg-[#004842] text-white shadow-sm"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{localized(cat.name, lang)}</span>
                {selectedCategoryId === cat._id && subCategories.length > 0 && (
                  <ChevronRight className="w-4 h-4 opacity-70 rotate-90" />
                )}
              </button>

              {selectedCategoryId === cat._id && subCategories.filter((s) => s.isActive).length > 0 && (
                <div className="ms-3 mt-1 flex flex-col gap-0.5 border-s-2 border-[#004842]/20 ps-3">
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
                            ? "bg-[#004842]/10 text-[#004842] font-medium"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            selectedSubCategoryId === sub._id ? "bg-[#004842]" : "bg-gray-300"
                          }`}
                        />
                        {localized(sub.name, lang)}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}

      {(selectedCategoryId || selectedSubCategoryId) && (
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

export default function ProductsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>()
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | undefined>()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const { data: categories, isLoading: catsLoading } = useCategoriesQuery()
  const { data: subCategories } = useSubCategoriesQuery(selectedCategoryId)
  const { data: rawProducts, isLoading: productsLoading } = useProductsQuery({
    categoryId: selectedCategoryId,
    subCategoryId: selectedSubCategoryId,
  })

  const products = (rawProducts ?? []).filter((p) => p.isActive).sort((a, b) => a.order - b.order)
  const activeCategories = (categories ?? []).filter((c) => c.isActive).sort((a, b) => a.order - b.order)
  const activeSubCategories = subCategories ?? []

  const handleCategorySelect = (id: string | undefined) => {
    setSelectedCategoryId(id)
    setSelectedSubCategoryId(undefined)
  }

  const handleClearFilters = () => {
    setSelectedCategoryId(undefined)
    setSelectedSubCategoryId(undefined)
  }

  const sidebarProps: SidebarProps = {
    lang,
    categories: activeCategories,
    subCategories: activeSubCategories,
    catsLoading,
    selectedCategoryId,
    selectedSubCategoryId,
    onCategorySelect: handleCategorySelect,
    onSubCategorySelect: setSelectedSubCategoryId,
    onClearFilters: handleClearFilters,
    t,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#004842] text-white py-14 px-4">
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
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              {!productsLoading ? (
                <p className="text-sm text-gray-500">
                  {products.length} {t("products")}
                </p>
              ) : (
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              )}

              {/* Mobile filter button */}
              <button
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm hover:border-[#004842]/30 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t("filters")}
                {(selectedCategoryId || selectedSubCategoryId) && (
                  <span className="w-2 h-2 rounded-full bg-[#004842]" />
                )}
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
                  {(selectedCategoryId || selectedSubCategoryId) && (
                    <button
                      onClick={handleClearFilters}
                      className="mt-2 text-sm text-[#004842] underline underline-offset-4"
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
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                  : products.map((product) => (
                      <ProductCard key={product._id} product={product} lang={lang} />
                    ))}
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
                className="w-full py-3 bg-[#004842] text-white rounded-xl font-medium text-sm hover:bg-[#003833] transition-colors"
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
