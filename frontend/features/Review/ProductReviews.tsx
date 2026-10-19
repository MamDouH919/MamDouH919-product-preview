"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Star, MessageSquareReply, Pencil, Trash2, BadgeCheck } from "lucide-react"
import { useAppSelector } from "@/Store/store"
import CustomLink from "@/components/CustomLink"
import {
  PRODUCT_REVIEWS_QUERY_KEY,
  REVIEW_ELIGIBILITY_QUERY_KEY,
  useProductReviewsQuery,
  useReviewEligibilityQuery,
} from "@/backend-api/reviews/hooks"
import { createReview, deleteMyReview, updateMyReview } from "@/backend-api/reviews/mutations"
import { MyReview, RatingSummary } from "@/backend-api/reviews/types"
import Stars from "./Stars"

const PAGE_SIZE = 5

const errorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message
  return Array.isArray(message) ? message.join(", ") : message ?? fallback
}

const formatDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" })

function Summary({ summary }: { summary: RatingSummary }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 sm:items-center">
      <div className="flex flex-col items-center sm:items-start gap-1.5 shrink-0">
        <span className="text-5xl font-bold text-gray-900 tabular-nums leading-none">
          {summary.average.toFixed(1)}
        </span>
        <Stars value={summary.average} size={18} label={t("ratingOutOfFive", { rating: summary.average.toFixed(1) })} />
        <span className="text-sm text-gray-500">{t("reviewsCount", { count: summary.count })}</span>
      </div>

      <div className="flex-1 flex flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary.distribution[String(star)] ?? 0
          const share = summary.count ? (count / summary.count) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 w-8 shrink-0 text-gray-600 tabular-nums">
                {star}
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${share}%` }} />
              </div>
              <span className="w-8 shrink-0 text-end text-gray-500 tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={t("yourRating")} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t("ratingOutOfFive", { rating: n })}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="p-0.5 rounded focus-visible:outline-2 focus-visible:outline-(--primary)"
        >
          <Star
            className={`w-8 h-8 transition-colors ${shown >= n ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  )
}

function ReviewForm({
  productId,
  existing,
  onDone,
}: {
  productId: string
  existing?: MyReview
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? "")

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? updateMyReview({ id: existing._id, data: { rating, comment } })
        : createReview({ productId, rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEW_ELIGIBILITY_QUERY_KEY, productId] })
      queryClient.invalidateQueries({ queryKey: [PRODUCT_REVIEWS_QUERY_KEY, productId] })
      toast.success(t("reviewSubmitted"))
      onDone?.()
    },
    onError: (error) => toast.error(errorMessage(error, t("somethingWentWrong"))),
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (rating > 0) mutation.mutate()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">{t("yourRating")}</span>
        <StarInput value={rating} onChange={setRating} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">{t("yourReview")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder={t("reviewPlaceholder")}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 focus:border-(--primary) focus:outline-none focus:ring-2 focus:ring-(--primary-10) resize-y"
        />
      </label>
      <p className="text-xs text-gray-400">{t("reviewModerationNote")}</p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={rating === 0 || mutation.isPending}
          className="h-11 px-6 rounded-xl bg-(--primary) text-white font-semibold transition-colors hover:bg-(--primary-dark) disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {existing ? t("updateReview") : t("submitReview")}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="h-11 px-5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </form>
  )
}

const STATUS_STYLES: Record<MyReview["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-gray-100 text-gray-600",
}

/** What the signed-in shopper can do here: write, see, edit or delete their own review. */
function MyReviewPanel({ productId }: { productId: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn)
  const { data: eligibility } = useReviewEligibilityQuery(productId)
  const [editing, setEditing] = useState(false)

  const remove = useMutation({
    mutationFn: (id: string) => deleteMyReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEW_ELIGIBILITY_QUERY_KEY, productId] })
      queryClient.invalidateQueries({ queryKey: [PRODUCT_REVIEWS_QUERY_KEY, productId] })
      toast.success(t("reviewDeleted"))
    },
    onError: (error) => toast.error(errorMessage(error, t("somethingWentWrong"))),
  })

  if (!isLoggedIn) {
    const here = typeof window !== "undefined" ? window.location.pathname : ""
    return (
      <p className="text-sm text-gray-600">
        <CustomLink
          href={`/account/login?from=${encodeURIComponent(here)}`}
          className="font-semibold text-(--primary) underline underline-offset-4"
        >
          {t("signIn")}
        </CustomLink>{" "}
        {t("signInToReview")}
      </p>
    )
  }

  if (!eligibility) return null

  const mine = eligibility.review
  if (mine && !editing) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{t("yourReview")}</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[mine.status]}`}>
            {t(`reviewStatus.${mine.status}`)}
          </span>
        </div>
        <Stars value={mine.rating} />
        {mine.comment && <p className="text-sm text-gray-600 whitespace-pre-line">{mine.comment}</p>}
        <span className="text-xs text-gray-400">{formatDate(mine.createdAt, i18n.language)}</span>
        <div className="flex gap-4 pt-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-(--primary)"
          >
            <Pencil className="w-4 h-4" />
            {t("edit")}
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(mine._id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {t("delete")}
          </button>
        </div>
      </div>
    )
  }

  if (mine && editing) {
    return <ReviewForm productId={productId} existing={mine} onDone={() => setEditing(false)} />
  }

  if (eligibility.canReview) return <ReviewForm productId={productId} />

  return <p className="text-sm text-gray-500">{t("reviewAfterDelivery")}</p>
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [page, setPage] = useState(1)
  const { data, isLoading } = useProductReviewsQuery(productId, page, PAGE_SIZE)

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <section id="reviews" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-16 scroll-mt-24">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-6 rounded-full bg-(--primary)" />
        <h2 className="text-xl font-bold text-gray-800">{t("customerReviews")}</h2>
      </div>

      {isLoading ? (
        <div className="h-28 rounded-xl bg-gray-100 animate-pulse" />
      ) : data && data.summary.count > 0 ? (
        <Summary summary={data.summary} />
      ) : (
        <p className="text-gray-500">{t("noReviewsYet")}</p>
      )}

      <div className="border-t border-gray-100 my-6" />
      <MyReviewPanel productId={productId} />

      {data && data.data.length > 0 && (
        <>
          <div className="border-t border-gray-100 my-6" />
          <ul className="flex flex-col divide-y divide-gray-100">
            {data.data.map((review) => (
              <li key={review._id} className="py-5 first:pt-0 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{review.authorName}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {t("verifiedPurchase")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(review.createdAt, lang)}</span>
                </div>
                <Stars value={review.rating} size={15} />
                {review.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{review.comment}</p>
                )}
                {review.reply && (
                  <div className="mt-1 ms-4 rounded-xl bg-gray-50 border-s-2 border-(--primary) px-4 py-3 flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      {t("storeReply")}
                    </span>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{review.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-9 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-40"
              >
                {t("previous")}
              </button>
              <span className="text-sm text-gray-500 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-40"
              >
                {t("next")}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
