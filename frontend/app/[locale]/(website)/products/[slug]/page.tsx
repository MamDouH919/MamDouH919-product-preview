"use client"

import { use, useState } from "react"
import { useProductBySlugQuery, useProductsQuery } from "@/backend-api/products/hooks"
import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import { ChevronRight, ShoppingBag, Tag, Package, ArrowLeft } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import Image from "next/image"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

function ProductCard({ product, lang }: { product: Product; lang: string }) {
  const name = localized(product.name, lang)
  const categoryName = localized(product.category?.name, lang)
  const image = product.images?.[0]

  return (
    <CustomLink
      href={`/products/${product.slug}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-[#004842]/25 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        {image ? (
          <Image
            src={getBackendUri(image)}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {categoryName && (
          <span className="absolute top-2.5 inset-s-2.5 text-[10px] font-semibold uppercase tracking-wide bg-white/90 backdrop-blur-sm text-[#004842] px-2 py-0.5 rounded-full shadow-sm">
            {categoryName}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
      </div>
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug flex-1">{name}</p>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
          {product.price != null ? (
            <span className="text-base font-bold text-[#004842]">{product.price.toLocaleString()}</span>
          ) : (
            <span />
          )}
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#004842]/8 group-hover:bg-[#004842] transition-colors duration-300">
            <ShoppingBag className="w-4 h-4 text-[#004842] group-hover:text-white transition-colors duration-300" />
          </span>
        </div>
      </div>
    </CustomLink>
  )
}

function DetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="flex flex-col gap-4">
          <div className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-16 h-16 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="h-5 w-1/3 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-9 w-4/5 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-1/3 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-20 w-full bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-px w-full bg-gray-200" />
          <div className="h-5 w-2/5 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-5 w-3/5 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function ProductDetailPage({ params }: PageProps) {
  const { slug: rawSlug } = use(params)
  const slug = decodeURIComponent(rawSlug)
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [activeImage, setActiveImage] = useState(0)

  const { data: product, isLoading, isError } = useProductBySlugQuery(slug)
  const { data: categoryProducts } = useProductsQuery(
    product?.category?._id ? { categoryId: product.category._id } : undefined
  )

  const relatedProducts = (categoryProducts ?? [])
    .filter((p) => p.isActive && p.slug !== slug)
    .sort((a, b) => a.order - b.order)
    .slice(0, 4)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 h-12 animate-pulse" />
        <DetailSkeleton />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-12 h-12 text-gray-300" />
          </div>
          <p className="text-gray-500 text-lg font-medium mb-4">{t("noData")}</p>
          <CustomLink
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-[#004842] underline underline-offset-4"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t("backToProducts")}
          </CustomLink>
        </div>
      </div>
    )
  }

  const images = product.images ?? []
  const name = localized(product.name, lang)
  const description = localized(product.description, lang)
  const shortDescription = localized(product.shortDescription, lang)
  const categoryName = localized(product.category?.name, lang)
  const subCategoryName = localized(product.subCategory?.name, lang)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
            <CustomLink href="/" className="hover:text-[#004842] transition-colors">
              {t("home")}
            </CustomLink>
            <ChevronRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
            <CustomLink href="/products" className="hover:text-[#004842] transition-colors">
              {t("products")}
            </CustomLink>
            <ChevronRight className="w-4 h-4 shrink-0 rtl:rotate-180" />
            <span className="text-gray-800 font-medium line-clamp-1">{name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Product main section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          {/* Image gallery */}
          <div className="flex flex-col gap-4">
            {/* Main image */}
            <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-square">
              {images[activeImage] ? (
                <Image
                  src={getBackendUri(images[activeImage])}
                  alt={name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <ShoppingBag className="w-20 h-20 text-gray-300" />
                </div>
              )}
              {/* Image counter badge */}
              {images.length > 1 && (
                <span className="absolute bottom-3 inset-e-3 text-xs bg-black/50 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {activeImage + 1} / {images.length}
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      activeImage === idx
                        ? "border-[#004842] shadow-md scale-105"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="relative w-full h-full">
                      <Image
                        src={getBackendUri(img)}
                        alt={`${name} ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col gap-5">
            {/* Category badges */}
            <div className="flex flex-wrap gap-2">
              {categoryName && (
                <span className="text-xs font-semibold uppercase tracking-wide bg-[#004842]/10 text-[#004842] px-3 py-1 rounded-full">
                  {categoryName}
                </span>
              )}
              {subCategoryName && (
                <span className="text-xs font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                  {subCategoryName}
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">{name}</h1>

            {/* Price */}
            {product.price != null && (
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#004842]">
                  {product.price.toLocaleString()}
                </span>
              </div>
            )}

            {/* Short description */}
            {shortDescription && (
              <p className="text-gray-600 leading-relaxed">{shortDescription}</p>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Meta details */}
            <div className="flex flex-col gap-3">
              {product.sku && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-gray-400 w-20 shrink-0">
                    <Package className="w-4 h-4" />
                    <span className="text-sm">{t("sku")}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-lg">
                    {product.sku}
                  </span>
                </div>
              )}

              {product.tags && product.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1.5 text-gray-400 w-20 shrink-0 pt-0.5">
                    <Tag className="w-4 h-4" />
                    <span className="text-sm">{t("tags")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-[#004842]/10 hover:text-[#004842] transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Back link */}
            <div className="mt-auto pt-4">
              <CustomLink
                href="/products"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#004842] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                {t("backToProducts")}
              </CustomLink>
            </div>
          </div>
        </div>

        {/* Full description */}
        {description && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-16">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-1 h-6 rounded-full bg-[#004842]" />
              <h2 className="text-xl font-bold text-gray-800">{t("description")}</h2>
            </div>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line">{description}</div>
          </div>
        )}

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1 h-6 rounded-full bg-[#004842]" />
              <h2 className="text-xl font-bold text-gray-800">{t("relatedProducts")}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {relatedProducts.map((related) => (
                <ProductCard key={related._id} product={related} lang={lang} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
