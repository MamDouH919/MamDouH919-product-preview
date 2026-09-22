"use client"

import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useCurrency } from "@/Hooks/useCurrency"
import { useTheme, alpha } from "@mui/material/styles"
import { ShoppingBag, ArrowUpRight } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import WhatsAppButton from "@/components/WhatsAppButton"
import Image from "next/image"

function localizedField(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

export default function ProductCard({ product, lang }: { product: Product; lang: string }) {
  const theme = useTheme()
  const currency = useCurrency()

  const name = localizedField(product.name, lang)
  const categoryName = localizedField(product.category?.name, lang)
  const image = product.images?.[0]

  const variants = product.variants ?? []
  const variantPrices = variants.map((v) => v.price).filter((p): p is number => p != null)
  const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : null
  const displayPrice = variants.length > 0 ? minVariantPrice : product.price
  const visibleVariants = variants.slice(0, 2)
  const extraVariantCount = variants.length - visibleVariants.length

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-8": alpha(theme.palette.primary.main, 0.08),
    "--primary-20": alpha(theme.palette.primary.main, 0.2),
    "--primary-shadow": alpha(theme.palette.primary.main, 0.28),
  } as React.CSSProperties

  return (
    <article
      style={cssVars}
      className="group relative flex flex-col rounded-[22px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_45px_-24px_var(--primary-shadow)] hover:ring-(--primary-20) transition-shadow duration-300"
    >
      {/* Whole-card link (kept out of the DOM flow so it never nests inside the WhatsApp anchor) */}
      <CustomLink
        href={`/products/${product.slug}`}
        ariaLabel={name}
        className="absolute inset-0 z-10 rounded-[22px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
      />

      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-t-[22px] bg-neutral-50">
        {image ? (
          <Image
            src={getBackendUri(image)}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-neutral-50 to-neutral-100">
            <ShoppingBag className="h-9 w-9 text-neutral-300" strokeWidth={1.5} />
          </div>
        )}

        {categoryName && (
          <span className="absolute start-3 top-3 z-20 rounded-full border border-black/5 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-neutral-600 shadow-sm backdrop-blur-sm">
            {categoryName}
          </span>
        )}

        <div className="absolute end-3 top-3 z-20">
          <WhatsAppButton slug={product.slug} productName={name} className="shadow-md" />
        </div>
      </div>

      {/* Info panel — floats slightly over the image to give the card depth */}
      <div className="relative z-20 -mt-6 mx-3 mb-3 rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04]">
        <p className="min-h-[2.5em] text-[14px] font-semibold leading-snug text-neutral-900 line-clamp-2">
          {name}
        </p>

        {visibleVariants.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleVariants.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-(--primary-8) px-2 py-0.5 text-[10px] font-medium text-(--primary)"
              >
                {v.label}
              </span>
            ))}
            {extraVariantCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                +{extraVariantCount}
              </span>
            )}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
          {displayPrice != null ? (
            <span className="text-[15px] font-bold text-(--primary)">
              {displayPrice.toLocaleString()}{" "}
              <span className="text-[11px] font-medium text-neutral-400">{currency}</span>
              {variants.length > 0 && <span className="text-[11px] font-semibold">+</span>}
            </span>
          ) : (
            <span className="text-sm text-neutral-300">—</span>
          )}

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-(--primary-20) text-(--primary) transition-colors duration-300 group-hover:border-(--primary) group-hover:bg-(--primary) group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-[22px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] animate-pulse">
      <div className="aspect-square rounded-t-[22px] bg-neutral-200" />
      <div className="relative -mt-6 mx-3 mb-3 rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04]">
        <div className="h-3.5 w-4/5 rounded-lg bg-neutral-200" />
        <div className="mt-2 h-3.5 w-2/5 rounded-lg bg-neutral-200" />
        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5">
          <div className="h-4 w-1/3 rounded-lg bg-neutral-200" />
          <div className="h-9 w-9 rounded-full bg-neutral-200" />
        </div>
      </div>
    </div>
  )
}
