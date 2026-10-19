"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog } from "@mui/material"
import { useTheme, alpha } from "@mui/material/styles"
import { ArrowUpRight, ShoppingBag, X } from "lucide-react"
import Image from "next/image"
import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useCurrency } from "@/Hooks/useCurrency"
import CustomLink from "@/components/CustomLink"
import AddToCart from "@/features/Cart/AddToCart"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

/** Picks the first variant that can actually be bought, so the dialog opens ready to add. */
function defaultVariant(product: Product): number | null {
  if (!product.variants?.length) return null
  if (!product.trackStock || product.allowBackorder) return 0
  const i = product.variants.findIndex((v) => v.stock > 0)
  return i === -1 ? 0 : i
}

export default function QuickAddDialog({
  product,
  open,
  onClose,
}: {
  product: Product
  open: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const theme = useTheme()
  const currency = useCurrency()
  const [variantIndex, setVariantIndex] = useState<number | null>(() => defaultVariant(product))

  const name = localized(product.name, lang)
  const categoryName = localized(product.category?.name, lang)
  const shortDescription = localized(product.shortDescription, lang)
  const image = product.images?.[0]
  const variants = product.variants ?? []
  const variant = variantIndex !== null ? variants[variantIndex] : undefined
  const price = variant?.price ?? product.price
  const limited = product.trackStock && !product.allowBackorder

  const cssVars = {
    "--primary": theme.palette.primary.main,
    "--primary-dark": theme.palette.primary.dark,
    "--primary-8": alpha(theme.palette.primary.main, 0.08),
    "--primary-50": alpha(theme.palette.primary.main, 0.5),
  } as React.CSSProperties

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ paper: { sx: { borderRadius: "24px", overflow: "hidden", m: 2 } } }}
    >
      <div style={cssVars} className="relative grid grid-cols-1 sm:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative aspect-[4/3] bg-neutral-100 sm:aspect-auto sm:min-h-[420px]">
          {image ? (
            <Image src={getBackendUri(image)} alt={name} fill sizes="(min-width: 640px) 448px, 100vw" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-neutral-300" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex flex-col gap-1.5 pe-8">
            {categoryName && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--primary)">
                {categoryName}
              </span>
            )}
            <h2 className="text-xl font-bold leading-snug text-neutral-900">{name}</h2>
            {price != null && (
              <p className="text-2xl font-bold text-neutral-900 tabular-nums">
                {price.toLocaleString()} <span className="text-sm font-medium text-neutral-400">{currency}</span>
              </p>
            )}
          </div>

          {shortDescription && (
            <p className="text-sm leading-relaxed text-neutral-500 line-clamp-3">{shortDescription}</p>
          )}

          {variants.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-500">{t("variants")}</span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => {
                  const soldOut = limited && v.stock <= 0
                  const active = variantIndex === i
                  return (
                    <button
                      key={v._id ?? i}
                      type="button"
                      onClick={() => setVariantIndex(i)}
                      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                        active
                          ? "border-(--primary) bg-(--primary) text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-(--primary-50)"
                      } ${soldOut ? "opacity-50 line-through" : ""}`}
                    >
                      {v.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-2">
            <AddToCart product={product} variantIndex={variantIndex} onAdded={onClose} />
            <CustomLink
              href={`/products/${product.slug}`}
              className="inline-flex items-center justify-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-(--primary)"
            >
              {t("viewDetails")}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </CustomLink>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
