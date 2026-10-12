"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Minus, Plus, ShoppingCart } from "lucide-react"
import { Product } from "@/backend-api/products/types"
import { useAppDispatch, useAppSelector } from "@/Store/store"
import { addToCart } from "@/Store/slices/cart"

/**
 * Quantity stepper + add button for the product page. Caps the quantity at
 * what's in stock (minus what's already in the cart) for stock-limited
 * products; the server re-checks at checkout regardless.
 */
export default function AddToCart({
  product,
  variantIndex,
}: {
  product: Product
  /** The selected variant, or null when none is chosen. */
  variantIndex: number | null
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const [quantity, setQuantity] = useState(1)

  const hasVariants = product.variants?.length > 0
  const variant = hasVariants && variantIndex !== null ? product.variants[variantIndex] : undefined
  const price = variant?.price ?? product.price

  const inCart = useAppSelector((state) =>
    state.cart.items.find(
      (i) => i.productId === product._id && (i.variantId ?? "") === (variant?._id ?? "")
    )?.quantity ?? 0
  )

  const limited = product.trackStock && !product.allowBackorder
  const stock = variant ? variant.stock : product.stock
  const remaining = limited ? Math.max(0, (stock ?? 0) - inCart) : Infinity

  const needsVariant = hasVariants && !variant
  const outOfStock = limited && (stock ?? 0) <= 0
  const noPrice = price == null
  const disabled = needsVariant || outOfStock || noPrice || remaining <= 0
  const qty = Math.min(quantity, remaining === Infinity ? 999 : Math.max(1, remaining))

  const add = () => {
    dispatch(
      addToCart({
        productId: product._id,
        variantId: variant?._id,
        quantity: qty,
        name: product.name,
        variantLabel: variant?.label,
        image: product.images?.[0],
        slug: product.slug,
        price,
      })
    )
    setQuantity(1)
    toast.success(t("addedToCart"), {
      action: {
        label: t("viewCart"),
        onClick: () => router.push(`/${i18n.language}/cart`),
      },
    })
  }

  let label = t("addToCart")
  if (outOfStock) label = t("outOfStock")
  else if (needsVariant) label = t("chooseVariant")
  else if (limited && remaining <= 0) label = t("allInCart")

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-3">
        <div className="flex items-center rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={disabled || qty <= 1}
            className="w-11 h-12 flex items-center justify-center text-gray-600 disabled:opacity-30"
            aria-label={t("decrease")}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center font-semibold text-gray-800 tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={disabled || qty >= remaining || qty >= 999}
            className="w-11 h-12 flex items-center justify-center text-gray-600 disabled:opacity-30"
            aria-label={t("increase")}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-(--primary) text-white font-semibold transition-colors hover:bg-(--primary-dark) disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-5 h-5" />
          {label}
        </button>
      </div>

      {limited && !outOfStock && (stock ?? 0) <= Math.max(product.lowStockThreshold ?? 0, 5) && (
        <p className="text-sm text-amber-600">{t("onlyNLeft", { count: stock })}</p>
      )}
    </div>
  )
}
