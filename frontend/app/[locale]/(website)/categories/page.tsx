import type { Metadata } from "next"
import CategoriesClient from "./_CategoriesClient"
import { pageMetadata, requestOrigin } from "@/lib/seo"
import { breadcrumbLd, JsonLd } from "@/lib/jsonLd"

const COPY = {
  ar: { title: "الأقسام", description: "تصفّح كل أقسام المتجر واختار اللي يناسبك، وكل قسم فيه منتجاته بالأسعار والتفاصيل." },
  en: { title: "Categories", description: "Browse every category in the store and find what suits you, each with its products, prices and details." },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return pageMetadata({ locale, path: "/categories", ...COPY[locale === "ar" ? "ar" : "en"] })
}

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, origin] = await Promise.all([params, requestOrigin()])
  return (
    <>
      <JsonLd data={breadcrumbLd(origin, locale, [{ name: COPY[locale === "ar" ? "ar" : "en"].title, path: "/categories" }])} />
      <CategoriesClient />
    </>
  )
}
