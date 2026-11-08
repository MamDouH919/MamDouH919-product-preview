"use client"

import { useTranslation } from "react-i18next"
import { RotateCcw, Truck } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import { usePagesNavigationQuery } from "@/backend-api/pages/hooks"
import { getLocalizedString } from "@/utils/helperFunctions"

/** Slugs the backend's policy templates (`npm run seed:policies`) create. */
const POLICIES = [
  { slug: "shipping-policy", Icon: Truck },
  { slug: "return-policy", Icon: RotateCcw },
] as const

/**
 * Links to the store's shipping and returns policies, where a shopper decides
 * to buy. Each shows only once its page exists and is published, and is
 * labelled with the page's own title, so renaming it in the dashboard carries over.
 */
export default function PolicyLinks({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation()
  const { data: pages } = usePagesNavigationQuery()

  const links = POLICIES.flatMap(({ slug, Icon }) => {
    const page = pages?.find((p) => p.slug === slug)
    return page ? [{ slug, Icon, label: getLocalizedString(page.title, i18n.language) }] : []
  })
  if (!links.length) return null

  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500 ${className}`}>
      {links.map(({ slug, Icon, label }) => (
        <CustomLink
          key={slug}
          href={`/${slug}`}
          className="inline-flex items-center gap-1.5 hover:text-(--primary) underline-offset-4 hover:underline transition-colors"
        >
          <Icon className="w-4 h-4" aria-hidden />
          {label}
        </CustomLink>
      ))}
    </div>
  )
}
