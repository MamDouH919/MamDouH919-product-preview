"use client"

import { useState } from "react"
import { useCategoriesQuery } from "@/backend-api/categories/hooks"
import { Category } from "@/backend-api/categories/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import CustomLink from "@/components/CustomLink"
import { useTheme, alpha } from "@mui/material/styles"
import { ArrowRight, ChevronRight, LayoutGrid, Search, X } from "lucide-react"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

type T = (key: string, options?: Record<string, unknown>) => string

function CategoryCard({ category, lang, t }: { category: Category; lang: string; t: T }) {
  const name = localized(category.name, lang)
  const description = localized(category.description, lang)

  return (
    <CustomLink
      href={`/categories/${category.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(0,0,0,0.35)] hover:ring-(--primary-30) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-gray-100">
        {category.image ? (
          <Image
            src={getBackendUri(category.image)}
            alt={name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-(--primary-10)">
            <span className="text-5xl font-bold text-(--primary) opacity-40">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {/* Bottom fade so the image sits softly on the card body */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <h2 className="line-clamp-1 text-base font-semibold text-gray-900 sm:text-lg">{name}</h2>
        {description && <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{description}</p>}

        <span className="mt-auto flex items-center justify-between pt-3 text-sm font-medium text-(--primary)">
          {t("browseCategory")}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--primary-10) transition-colors duration-300 group-hover:bg-(--primary) group-hover:text-white">
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </span>
        </span>
      </div>
    </CustomLink>
  )
}

function CategoryCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
      <div className="aspect-4/3 animate-pulse bg-gray-200/70" />
      <div className="flex flex-col gap-2 p-4 sm:p-5">
        <div className="h-5 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-8 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}

export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const theme = useTheme()
  const [search, setSearch] = useState("")

  const { data, isLoading } = useCategoriesQuery()
  const categories = (data ?? []).filter((c) => c.isActive).sort((a, b) => a.order - b.order)

  // The list is small and already loaded, so filter locally as the user types.
  const term = search.trim().toLowerCase()
  const visible = term
    ? categories.filter((c) =>
        [localized(c.name, lang), localized(c.description, lang)].some((s) => s.toLowerCase().includes(term))
      )
    : categories

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--primary-10": alpha(theme.palette.primary.main, 0.1),
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
            <span className="text-white">{t("categories")}</span>
          </nav>

          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t("categories")}</h1>
            <p className="mt-3 text-base text-white/75 md:text-lg">{t("categoriesSubtitle")}</p>
          </div>

          <label className="relative mt-8 block max-w-2xl">
            <Search className="pointer-events-none absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchCategoriesPlaceholder")}
              aria-label={t("search")}
              maxLength={100}
              className="h-14 w-full rounded-2xl bg-white pe-12 ps-14 text-base text-gray-900 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.45)] outline-none ring-4 ring-transparent transition placeholder:text-gray-400 focus:ring-white/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
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
        {/* Summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.25)] ring-1 ring-black/5">
          {isLoading ? (
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--primary-10) text-(--primary)">
                <LayoutGrid className="h-4 w-4" />
              </span>
              <span className="font-semibold text-gray-900">{t("categoriesCount", { count: visible.length })}</span>
              {term && <span>{t("resultsFor", { q: search.trim() })}</span>}
            </p>
          )}
          <CustomLink
            href="/products"
            className="flex h-10 items-center gap-2 rounded-xl bg-(--primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--primary-dark)"
          >
            {t("allProducts")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </CustomLink>
        </div>

        {/* Empty state */}
        {!isLoading && visible.length === 0 && (
          <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl bg-white px-6 py-24 text-center ring-1 ring-black/5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-(--primary-10)">
              <LayoutGrid className="h-9 w-9 text-(--primary)" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-semibold text-gray-800">{t("noCategoriesFound")}</p>
            {term && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-xl bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary-dark)"
              >
                {t("clearFilters")}
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {(isLoading || visible.length > 0) && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <CategoryCardSkeleton key={i} />)
              : visible.map((category) => (
                  <CategoryCard key={category._id} category={category} lang={lang} t={t} />
                ))}
          </div>
        )}
      </div>
    </div>
  )
}
