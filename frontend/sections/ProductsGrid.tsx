"use client"

import { useProductsQuery } from "@/backend-api/products/hooks"
import { useTranslation } from "react-i18next"
import { ShoppingBag } from "lucide-react"
import CustomLink from "@/components/CustomLink"
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard"
import { Container } from "@mui/material"
import { useTheme } from "@mui/material/styles"

export default function ProductsGrid() {
  const { data, isLoading } = useProductsQuery()
  const { t, i18n } = useTranslation()
  const theme = useTheme()

  const products = (data ?? [])
    .filter((p) => p.isActive)
    .sort((a, b) => a.order - b.order)

  const cssVars = {
    "--primary": theme.palette.primary.main,
  } as React.CSSProperties

  return (
    <Container style={cssVars}>
      <div className="px-4 flex flex-col gap-5">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-1 h-6 rounded-full bg-(--primary)" />
            <h2 className="text-xl font-bold text-gray-800">{t("products")}</h2>
          </div>
          {!isLoading && products.length > 0 && (
            <CustomLink
              href="/products"
              className="text-sm font-medium text-(--primary) hover:underline underline-offset-4"
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
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((product) => (
                <ProductCard key={product._id} product={product} lang={i18n.language} />
              ))}
          </div>
        )}
      </div>
    </Container>
  )
}
