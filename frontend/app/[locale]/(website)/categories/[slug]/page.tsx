"use client"

import { use, useState } from "react"
import { useCategoryBySlugQuery } from "@/backend-api/categories/hooks"
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks"
import { useProductsQuery } from "@/backend-api/products/hooks"
import { Product } from "@/backend-api/products/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import CustomLink from "@/components/CustomLink"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import Card from "@mui/material/Card"
import { useTheme, alpha } from "@mui/material/styles"
import { useCurrency } from "@/Hooks/useCurrency"
import { ShoppingBag, ArrowLeft, ChevronRight } from "lucide-react"
import WhatsAppButton from "@/components/WhatsAppButton"
import { Grid } from "@mui/material"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

function ProductCard({ product, lang }: { product: Product; lang: string }) {
  const theme = useTheme()
  const name = localized(product.name, lang)
  const image = product.images?.[0]
  const currency = useCurrency()

  return (
    <CustomLink href={`/products/${product.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <Card
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "grey.100",
          borderRadius: 1,
          overflow: "hidden",
          height: "100%",
          transition: "all 0.3s",
          "&:hover": {
            borderColor: alpha(theme.palette.primary.main, 0.3),
            boxShadow: 4,
            transform: "translateY(-3px)",
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            paddingTop: "100%",
            bgcolor: "grey.50",
          }}
        >
          {image ? (
            <Image
              src={getBackendUri(image)}
              alt={name}
              fill
              style={{ objectFit: "cover" }}
            />
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "grey.100",
              }}
            >
              <ShoppingBag size={40} color={theme.palette.grey[300]} />
            </Box>
          )}
        </Box>

        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {name}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pt: 0.5,
              borderTop: "1px solid",
              borderColor: "grey.100",
            }}
          >
            {product.price != null ? (
              <Typography variant="subtitle2" fontWeight={700} color="primary">
                {product.price.toLocaleString()} {currency}
              </Typography>
            ) : (
              <Box />
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <WhatsAppButton slug={product.slug} productName={name} />
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingBag size={16} color={theme.palette.primary.main} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Card>
    </CustomLink>
  )
}

function PageSkeleton() {
  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 4 }}>
      <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start", flexDirection: { xs: "column", md: "row" } }}>
        <Box sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <Skeleton variant="rectangular" width="100%" height={260} sx={{ borderRadius: 2 }} />
          <Skeleton variant="text" width="55%" height={32} />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="75%" />
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" width={80} height={32} />
            ))}
          </Box>
          <Divider />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 2 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Box key={i}>
                <Skeleton variant="rectangular" width="100%" height={160} sx={{ borderRadius: 2, mb: 1 }} />
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function CategoryPage({ params }: PageProps) {
  const { slug } = use(params)
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const theme = useTheme()

  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | undefined>(undefined)

  const { data: category, isLoading: loadingCategory } = useCategoryBySlugQuery(slug)

  const { data: subCategories, isLoading: loadingSubs } = useSubCategoriesQuery(category?._id)
  const activeSubs = (subCategories ?? [])
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order)

  const { data: productsData, isLoading: loadingProducts } = useProductsQuery(
    category?._id
      ? { categoryId: category._id, subCategoryId: selectedSubCategoryId }
      : undefined
  )
  const products = (productsData ?? [])
    .filter((p) => p.isActive)
    .sort((a, b) => a.order - b.order)

  if (loadingCategory) return <PageSkeleton />

  if (!category) {
    return (
      <Box sx={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ textAlign: "center", px: 2 }}>
          <Typography variant="h6" color="text.secondary" mb={2}>
            {t("noData")}
          </Typography>
          <CustomLink href="/" style={{ color: theme.palette.primary.main, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={16} />
            {t("home")}
          </CustomLink>
        </Box>
      </Box>
    )
  }

  const name = localized(category.name, lang)
  const description = localized(category.description, lang)
  const hasSubs = !loadingSubs && activeSubs.length > 0

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Breadcrumb */}
      <Box sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Box
          sx={{
            maxWidth: 1200,
            mx: "auto",
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexWrap: "wrap",
          }}
        >
          <CustomLink href="/" style={{ color: theme.palette.text.secondary, textDecoration: "none", fontSize: 14 }}>
            {t("home")}
          </CustomLink>
          <ChevronRight size={14} color={theme.palette.text.disabled} />
          <CustomLink href="/categories" style={{ color: theme.palette.text.secondary, textDecoration: "none", fontSize: 14 }}>
            {t("categories")}
          </CustomLink>
          <ChevronRight size={14} color={theme.palette.text.disabled} />
          <Typography variant="body2" color="text.primary" fontWeight={500}>
            {name}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 4 }}>
        <Box
          sx={{
            display: "flex",
            gap: 4,
            alignItems: "flex-start",
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          {/* Left: category info */}
          <Box
            sx={{
              width: { xs: "100%", md: 260 },
              flexShrink: 0,
              position: { md: "sticky" },
              top: { md: 24 },
            }}
          >
            {/* Image */}
            <Box
              sx={{
                position: "relative",
                width: "100%",
                paddingTop: "100%",
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "grey.100",
                mb: 2.5,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              {category.image ? (
                <Image
                  src={getBackendUri(category.image)}
                  alt={name}
                  fill
                  style={{ objectFit: "cover" }}
                  priority
                />
              ) : (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography variant="h2" color="text.disabled" fontWeight={700}>
                    {name.charAt(0).toUpperCase()}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Name */}
            <Typography variant="h5" fontWeight={700} color="text.primary" gutterBottom>
              {name}
            </Typography>

            {/* Description */}
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {description}
              </Typography>
            )}
          </Box>

          {/* Right: sub-categories + products */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Sub-category chips */}
            {(loadingSubs || hasSubs) && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                {loadingSubs ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" width={80} height={32} />
                  ))
                ) : (
                  <>
                    <Chip
                      label={t("allProducts")}
                      onClick={() => setSelectedSubCategoryId(undefined)}
                      variant={selectedSubCategoryId === undefined ? "filled" : "outlined"}
                      color={selectedSubCategoryId === undefined ? "primary" : "default"}
                    />
                    {activeSubs.map((sub) => (
                      <Chip
                        key={sub._id}
                        label={localized(sub.name, lang)}
                        onClick={() =>
                          setSelectedSubCategoryId(
                            selectedSubCategoryId === sub._id ? undefined : sub._id
                          )
                        }
                        variant={selectedSubCategoryId === sub._id ? "filled" : "outlined"}
                        color={selectedSubCategoryId === sub._id ? "primary" : "default"}
                      />
                    ))}
                    <Divider sx={{ mb: 3 }} />
                  </>
                )}
              </Box>
            )}


            {/* Products */}
            {loadingProducts ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 2,
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Box key={i}>
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={160}
                      sx={{ borderRadius: 2, mb: 1 }}
                    />
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                ))}
              </Box>
            ) : products.length === 0 ? (
              <Box
                sx={{
                  py: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  color: "text.disabled",
                }}
              >
                <ShoppingBag size={56} strokeWidth={1} />
                <Typography variant="body1" fontWeight={500}>
                  {t("noData")}
                </Typography>
              </Box>
            ) : (
              <Grid
                container
                spacing={2}
              >
                {products.map((product) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 4 }} key={product._id}>
                    <ProductCard  product={product} lang={lang} />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
