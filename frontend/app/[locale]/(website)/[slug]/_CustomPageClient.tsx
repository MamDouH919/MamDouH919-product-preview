"use client"

import { use } from "react"
import { useTranslation } from "react-i18next"
import { FileQuestion } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import { usePageBySlugQuery } from "@/backend-api/pages/hooks"
import PageRenderer from "@/features/Page/PageRenderer"

function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-6">
      <div className="h-10 w-1/2 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-64 w-full bg-gray-200 rounded-2xl animate-pulse" />
      <div className="h-5 w-full bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-5 w-4/5 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-5 w-3/5 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  )
}

interface Props {
  params: Promise<{ slug: string }>
}

export default function CustomPageClient({ params }: Props) {
  const { slug: rawSlug } = use(params)
  const slug = decodeURIComponent(rawSlug)
  const { t, i18n } = useTranslation()
  const { data: page, isLoading, isError } = usePageBySlugQuery(slug)

  if (isLoading) return <PageSkeleton />

  if (isError || !page) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 flex flex-col items-center gap-4 text-center">
        <FileQuestion className="w-16 h-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800">{t("pageNotFound")}</h1>
        <p className="text-gray-500">{t("pageNotFoundHint")}</p>
        <CustomLink
          href="/"
          className="mt-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          {t("backToHome")}
        </CustomLink>
      </div>
    )
  }

  return (
    <PageRenderer
      title={page.title}
      settings={page.settings}
      blocks={page.blocks}
      lang={i18n.language}
    />
  )
}
