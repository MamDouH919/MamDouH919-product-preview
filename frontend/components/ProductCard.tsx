"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useCurrency } from "@/Hooks/useCurrency"
import { useTheme, alpha } from "@mui/material/styles"
import { ShoppingBag, Plus, Star } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import WhatsAppButton from "@/components/WhatsAppButton"
import WishlistButton from "@/features/Wishlist/WishlistButton"
import QuickAddDialog from "@/features/Cart/QuickAddDialog"
import { preorderUnits } from "@/lib/preorder"
import { useStoreModules } from "@/Hooks/useStoreModules"
import { saleFrom } from "@/lib/productOffer"
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
  // A catalog store takes no orders, so it has no cart, wishlist or stock to show.
  const { has, showPrices, preorders } = useStoreModules()
  const sells = has("orders")

  const name = localizedField(product.name, lang)
  const categoryName = localizedField(product.category?.name, lang)
  const image = product.images?.[0]
  const hoverImage = product.images?.[1]

  const variants = product.variants ?? []
  // A variant without its own price sells at the product's, as at checkout.
  const variantPrices = variants.map((v) => v.price ?? product.price).filter((p): p is number => p != null)
  const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : null
  const displayPrice = variants.length > 0 ? minVariantPrice : product.price
  // A "from" price spans variants, so only a single-price product shows a "was" price.
  const wasPrice = !variants.length && displayPrice != null ? saleFrom(displayPrice, product.compareAtPrice) : undefined
  const visibleVariants = variants.slice(0, 3)
  const extraVariantCount = variants.length - visibleVariants.length

  const limited = has("inventory") && product.trackStock && !product.allowBackorder
  const stock = product.totalStock ?? (variants.length ? variants.reduce((s, v) => s + (v.stock ?? 0), 0) : product.stock)
  // Out here but held in another warehouse: still for sale, as a pre-order.
  const preorderable = limited && preorders ? (variants.length ? variants.reduce((s, v) => s + preorderUnits(v), 0) : preorderUnits(product)) : 0
  const soldOut = limited && (stock ?? 0) <= 0 && preorderable <= 0
  const preorderOnly = limited && (stock ?? 0) <= 0 && preorderable > 0
  const canQuickAdd = !soldOut && displayPrice != null

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--primary-glow": alpha(theme.palette.primary.main, 0.45),
  } as React.CSSProperties

  return (
    <article
      style={cssVars}
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-inset ring-[#ECECE8] transition-shadow duration-300 hover:shadow-[0_24px_44px_-22px_var(--primary-glow)]"
    >
      {/* Whole-card link; every interactive control sits above it (z-20) so nothing nests inside the anchor */}
      <CustomLink
        href={`/products/${product.slug}`}
        ariaLabel={name}
        className="absolute inset-0 z-10 rounded-[20px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-(--primary)"
      />

      {/* Media: the whole photo is shown, nothing is written over it */}
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-[#F6F6F3]">
        {image ? (
          <>
            <Image
              src={getBackendUri(image)}
              alt={name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={`object-cover transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.04] ${
                hoverImage ? "md:group-hover:opacity-0" : ""
              } ${soldOut ? "grayscale opacity-50" : ""}`}
            />
            {hoverImage && (
              <Image
                src={getBackendUri(hoverImage)}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="hidden object-cover opacity-0 transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-100 md:block"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_30%_10%,var(--primary)_0%,var(--primary-dark)_55%,#0a0a0a_100%)]">
            <ShoppingBag className="h-12 w-12 text-white/30" strokeWidth={1.25} />
          </div>
        )}

        {/* Status badge (start) and actions (end) */}
        <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            {soldOut && (
              <span className="pointer-events-none rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                {t("outOfStock")}
              </span>
            )}
            {preorderOnly && (
              <span className="pointer-events-none rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 shadow-sm">
                {t("preorder")}
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {sells && <WishlistButton productId={product._id} />}
            <WhatsAppButton slug={product.slug} productName={name} className="h-9! w-9! shadow-md" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="pointer-events-none relative z-20 flex flex-1 flex-col gap-2 p-4">
        {(categoryName || !!product.ratingCount) && (
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[11px] font-semibold tracking-wide text-(--primary)">{categoryName}</span>
            {!!product.ratingCount && (
              <span
                className="flex shrink-0 items-center gap-1 text-xs text-neutral-500"
                aria-label={t("ratingOutOfFive", { rating: (product.ratingAverage ?? 0).toFixed(1) })}
              >
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
                <span className="font-semibold text-neutral-900 tabular-nums">{(product.ratingAverage ?? 0).toFixed(1)}</span>
                <span className="tabular-nums">({product.ratingCount})</span>
              </span>
            )}
          </div>
        )}

        <h3 className="text-[15px] font-semibold leading-snug text-neutral-900 line-clamp-2">{name}</h3>

        {visibleVariants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleVariants.map((v) => (
              <span
                key={v._id}
                className="rounded-lg bg-[#F6F6F3] px-2 py-px text-[11px] font-medium text-neutral-500 ring-1 ring-inset ring-[#ECECE8]"
              >
                {v.label}
              </span>
            ))}
            {extraVariantCount > 0 && (
              <span className="rounded-lg px-1 py-px text-[11px] font-medium text-neutral-400">+{extraVariantCount}</span>
            )}
          </div>
        )}

        {(showPrices || sells) && (
          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            {showPrices && (
              <div className="flex min-w-0 flex-col leading-none">
                {variants.length > 1 && displayPrice != null && (
                  <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">{t("from")}</span>
                )}
                {displayPrice != null ? (
                  <span className="flex flex-wrap items-baseline gap-x-1 text-neutral-900">
                    <span className={`text-[22px] font-extrabold leading-[30px] tabular-nums tracking-tight ${soldOut ? "text-neutral-400" : ""}`}>{displayPrice.toLocaleString()}</span>
                    <span className="text-[11px] font-medium text-neutral-500">{currency}</span>
                    {wasPrice != null && (
                      <span className="ms-1 text-xs tabular-nums text-neutral-400 line-through">{wasPrice.toLocaleString()}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-300">—</span>
                )}
              </div>
            )}

            {/* Only color and transform animate here — no width/padding changes, so hover never triggers layout */}
            {sells && (
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                disabled={!canQuickAdd}
                aria-label={t("addToCart")}
                title={t("addToCart")}
                className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--primary) text-white transition-[background-color,color,transform] duration-200 hover:scale-105 hover:bg-(--primary-dark) active:scale-95 disabled:cursor-not-allowed disabled:bg-[#EBEBE8] disabled:text-neutral-400"
              >
                <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.25} />
              </button>
            )}
          </div>
        )}
      </div>

      {sells && <QuickAddDialog product={product} open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />}
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-inset ring-[#ECECE8]">
      <div className="aspect-square w-full bg-neutral-200" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/4 rounded bg-neutral-200" />
        <div className="h-4 w-4/5 rounded-lg bg-neutral-200" />
        <div className="h-4 w-3/5 rounded-lg bg-neutral-200" />
        <div className="mt-3 flex items-end justify-between border-t border-neutral-100 pt-3">
          <div className="h-6 w-1/3 rounded-lg bg-neutral-200" />
          <div className="h-10 w-10 rounded-full bg-neutral-200" />
        </div>
      </div>
    </div>
  )
}
