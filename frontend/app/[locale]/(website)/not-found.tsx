"use client"

import { useTranslation } from "react-i18next"
import { SearchX } from "lucide-react"
import CustomLink from "@/components/CustomLink"

/**
 * Shown, with a 404 status, for a product, category or page that doesn't
 * exist — inside the site's header and footer, so the visitor can carry on.
 * Next marks it noindex itself.
 */
export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <SearchX className="w-12 h-12 text-gray-400" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-gray-400 tracking-widest mb-2">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("notFoundTitle")}</h1>
        <p className="text-gray-500 leading-relaxed mb-8">{t("notFoundHint")}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <CustomLink
            href=""
            className="inline-flex items-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            {t("backToHome")}
          </CustomLink>
          <CustomLink
            href="/products"
            className="inline-flex items-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-colors"
          >
            {t("browseProducts")}
          </CustomLink>
        </div>
      </div>
    </div>
  )
}
