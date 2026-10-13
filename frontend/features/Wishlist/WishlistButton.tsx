"use client"

import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Heart } from "lucide-react"
import { useAppSelector } from "@/Store/store"
import { useWishlistQuery, WISHLIST_QUERY_KEY } from "@/backend-api/customers/hooks"
import { addToWishlist, removeFromWishlist } from "@/backend-api/customers/mutations"

/**
 * Heart toggle. Guests are sent to sign in and brought back; signed-in
 * customers toggle in place. `icon` is the round button for cards, `full` the
 * labelled one for the product page.
 */
export default function WishlistButton({
  productId,
  variant = "icon",
  className = "",
}: {
  productId: string
  variant?: "icon" | "full"
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn)

  // Every heart on the page shares this one cached request.
  const { data: wishlist } = useWishlistQuery()
  const saved = !!wishlist?.some((p) => p._id === productId)

  const mutation = useMutation({
    mutationFn: () => (saved ? removeFromWishlist(productId) : addToWishlist(productId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WISHLIST_QUERY_KEY] })
      toast.success(saved ? t("removedFromWishlist") : t("addedToWishlist"))
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  })

  const onClick = (e: React.MouseEvent) => {
    // Cards are links; the heart must not open the product.
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn) {
      toast.info(t("signInToSave"))
      // Include the query so a filtered product list comes back as it was.
      const here = window.location.pathname + window.location.search
      router.push(`/${i18n.language}/account/login?from=${encodeURIComponent(here)}`)
      return
    }
    mutation.mutate()
  }

  const label = saved ? t("removeFromWishlist") : t("addToWishlist")
  const heart = (
    <Heart
      className={variant === "icon" ? "h-4 w-4" : "h-5 w-5"}
      fill={saved ? "currentColor" : "none"}
      strokeWidth={2}
    />
  )

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={mutation.isPending}
        aria-pressed={saved}
        className={`flex items-center justify-center gap-2 h-12 rounded-xl border font-semibold transition-colors disabled:opacity-60 ${
          saved
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-gray-200 bg-white text-gray-700 hover:border-rose-200 hover:text-rose-600"
        } ${className}`}
      >
        {heart}
        {saved ? t("savedToWishlist") : t("addToWishlist")}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={mutation.isPending}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md backdrop-blur-sm transition-colors disabled:opacity-60 ${
        saved ? "text-rose-500" : "text-neutral-500 hover:text-rose-500"
      } ${className}`}
    >
      {heart}
    </button>
  )
}
