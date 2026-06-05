"use client"

import { useProductsQuery } from "@/backend-api/products/hooks"
import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import { ShoppingBag } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import Image from "next/image"
import { useCurrency } from "@/Hooks/useCurrency"
import WhatsAppButton from "@/components/WhatsAppButton"
import { Container } from "@mui/material"

function localizedName(field: Product["name"], lang: string) {
  return field[lang] || field["ar"] || field["en"] || ""
}

function ProductCard({ product, lang }: { product: Product; lang: string }) {
  const name = localizedName(product.name, lang)
  const categoryName = localizedName(product.category?.name ?? {}, lang)
  const image = product.images?.[0]
  const currency = useCurrency()

  return (
    <CustomLink
      href={`/products/${product.slug}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-[#004842]/25 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        {image ? (
          <Image
            src={getBackendUri(image)}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-108"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-100">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
            <span className="text-xs text-gray-400">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}

        {/* Category badge */}
        {categoryName && (
          <span className="absolute top-2.5 start-2.5 text-[10px] font-semibold uppercase tracking-wide bg-white/90 backdrop-blur-sm text-[#004842] px-2 py-0.5 rounded-full shadow-sm">
            {categoryName}
          </span>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug flex-1">
          {name}
        </p>

        {/* Variants */}
        {product.variants?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variants.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#004842]/8 text-[#004842]"
              >
                {v.label}
                {v.price != null && (
                  <span className="opacity-70">· {v.price.toLocaleString()} {currency}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
          {product.variants?.length > 0 ? (
            (() => {
              const prices = product.variants.map((v) => v.price).filter((p): p is number => p != null)
              const min = prices.length ? Math.min(...prices) : null
              return min != null ? (
                <span className="text-base font-bold text-[#004842]">
                  {min.toLocaleString()} {currency}+
                </span>
              ) : <span />
            })()
          ) : product.price != null ? (
            <span className="text-base font-bold text-[#004842]">
              {product.price.toLocaleString()} {currency}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            <WhatsAppButton slug={product.slug} productName={name} />
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#004842]/8 group-hover:bg-[#004842] transition-colors duration-300">
              <ShoppingBag className="w-4 h-4 text-[#004842] group-hover:text-white transition-colors duration-300" />
            </span>
          </div>
        </div>
      </div>
    </CustomLink>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="flex flex-col gap-3 p-3">
        <div className="h-4 w-4/5 bg-gray-200 rounded-lg" />
        <div className="h-3 w-3/5 bg-gray-200 rounded-lg" />
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="h-5 w-1/4 bg-gray-200 rounded-lg" />
          <div className="w-8 h-8 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default function ProductsGrid() {
  const { data, isLoading } = useProductsQuery()
  const { t, i18n } = useTranslation()

  const products = (data ?? [])
    .filter((p) => p.isActive)
    .sort((a, b) => a.order - b.order)

  return (
    <Container>
      <div className="px-4 flex flex-col gap-5">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-1 h-6 rounded-full bg-[#004842]" />
            <h2 className="text-xl font-bold text-gray-800">{t("products")}</h2>
          </div>
          {!isLoading && products.length > 0 && (
            <CustomLink
              href="/products"
              className="text-sm font-medium text-[#004842] hover:underline underline-offset-4"
            >
              {t("viewAll")}
            </CustomLink>
          )}
        </div>

        {/* Empty state */}
        {!isLoading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
            <ShoppingBag className="w-14 h-14 opacity-30" />
            <p className="text-base font-medium">{t("noData")}</p>
          </div>
        )}

        {/* Grid */}
        {(isLoading || products.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : products.map((product) => (
                <ProductCard key={product._id} product={product} lang={i18n.language} />
              ))}
          </div>
        )}
      </div>
    </Container>
  )
}
