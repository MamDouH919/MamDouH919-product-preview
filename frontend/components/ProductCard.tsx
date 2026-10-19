"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useCurrency } from "@/Hooks/useCurrency"
import { useTheme, alpha } from "@mui/material/styles"
import { ShoppingBag, Plus } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import WhatsAppButton from "@/components/WhatsAppButton"
import WishlistButton from "@/features/Wishlist/WishlistButton"
import QuickAddDialog from "@/features/Cart/QuickAddDialog"
import Image from "next/image"

function localizedField(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

export default function ProductCard({ product, lang }: { product: Product; lang: string }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const currency = useCurrency()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const name = localizedField(product.name, lang)
  const categoryName = localizedField(product.category?.name, lang)
  const image = product.images?.[0]
  const hoverImage = product.images?.[1]

  const variants = product.variants ?? []
  const variantPrices = variants.map((v) => v.price).filter((p): p is number => p != null)
  const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : null
  const displayPrice = variants.length > 0 ? minVariantPrice : product.price
  const visibleVariants = variants.slice(0, 3)
  const extraVariantCount = variants.length - visibleVariants.length

  const limited = product.trackStock && !product.allowBackorder
  const stock = product.totalStock ?? (variants.length ? variants.reduce((s, v) => s + (v.stock ?? 0), 0) : product.stock)
  const soldOut = limited && (stock ?? 0) <= 0
  const canQuickAdd = !soldOut && displayPrice != null

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--primary-glow": alpha(theme.palette.primary.main, 0.45),
  } as React.CSSProperties

  return (
    <article
      style={cssVars}
      className="group relative isolate aspect-3/4 overflow-hidden rounded-[28px] bg-neutral-900 shadow-[0_2px_6px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-[0_24px_44px_-22px_var(--primary-glow)]"
    >
      {/* Whole-card link; every interactive control sits above it (z-20) so nothing nests inside the anchor */}
      <CustomLink
        href={`/products/${product.slug}`}
        ariaLabel={name}
        className="absolute inset-0 z-10 rounded-[28px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
      />

      {/* Media */}
      {image ? (
        <>
          <Image
            src={getBackendUri(image)}
            alt={name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover will-change-transform transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.05] ${
              hoverImage ? "md:group-hover:opacity-0" : ""
            } ${soldOut ? "grayscale" : ""}`}
          />
          {hoverImage && (
            <Image
              src={getBackendUri(hoverImage)}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="hidden object-cover opacity-0 will-change-transform transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.05] group-hover:opacity-100 md:block"
            />
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_30%_10%,var(--primary)_0%,var(--primary-dark)_55%,#0a0a0a_100%)]">
          <ShoppingBag className="h-12 w-12 text-white/30" strokeWidth={1.25} />
        </div>
      )}

      {/* Readability scrim behind the bottom text, plus a light one so top controls hold on bright photos */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/90 via-black/50 via-45% to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-linear-to-b from-black/25 to-transparent" />

      {/* Top row */}
      <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          {categoryName && (
            <span className="pointer-events-none max-w-full truncate rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-neutral-800 shadow-md">
              {categoryName}
            </span>
          )}
          {soldOut && (
            <span className="pointer-events-none rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
              {t("outOfStock")}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <WishlistButton productId={product._id} />
          <WhatsAppButton slug={product.slug} productName={name} className="h-9! w-9! shadow-md" />
        </div>
      </div>

      {/* Bottom info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 p-4">
        {visibleVariants.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleVariants.map((v) => (
              <span
                key={v._id}
                className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/20"
              >
                {v.label}
              </span>
            ))}
            {extraVariantCount > 0 && (
              <span className="rounded-md px-1 py-0.5 text-[10px] font-medium text-white/60">+{extraVariantCount}</span>
            )}
          </div>
        )}

        <h3 className="text-base font-semibold leading-snug text-white line-clamp-2 [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]">
          {name}
        </h3>

        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col leading-none">
            {variants.length > 1 && displayPrice != null && (
              <span className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">{t("from")}</span>
            )}
            {displayPrice != null ? (
              <span className="flex items-baseline gap-1 text-white">
                <span className="text-xl font-extrabold tabular-nums tracking-tight">{displayPrice.toLocaleString()}</span>
                <span className="text-[11px] font-medium text-white/60">{currency}</span>
              </span>
            ) : (
              <span className="text-sm text-white/40">—</span>
            )}
          </div>

          {/* Only color and transform animate here — no width/padding changes, so hover never triggers layout */}
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            disabled={!canQuickAdd}
            aria-label={t("addToCart")}
            title={t("addToCart")}
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg transition-[background-color,color,transform] duration-200 hover:scale-105 group-hover:bg-(--primary) group-hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
          >
            <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <QuickAddDialog product={product} open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="relative aspect-3/4 overflow-hidden rounded-[28px] bg-neutral-200 animate-pulse">
      <div className="absolute inset-s-3 top-3 h-6 w-20 rounded-full bg-neutral-300" />
      <div className="absolute inset-e-3 top-3 h-9 w-9 rounded-full bg-neutral-300" />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2.5">
        <div className="h-4 w-4/5 rounded-lg bg-neutral-300" />
        <div className="h-4 w-3/5 rounded-lg bg-neutral-300" />
        <div className="flex items-end justify-between">
          <div className="h-6 w-1/3 rounded-lg bg-neutral-300" />
          <div className="h-11 w-11 rounded-full bg-neutral-300" />
        </div>
      </div>
    </div>
  )
}
