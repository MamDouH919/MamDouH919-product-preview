"use client"

import { useCategoriesQuery } from "@/backend-api/categories/hooks"
import { Category } from "@/backend-api/categories/types"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import CustomLink from "@/components/CustomLink"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import { useTheme, alpha } from "@mui/material/styles"
import { ChevronRight, LayoutGrid } from "lucide-react"

function localized(field: Record<string, string | undefined> | undefined, lang: string) {
  if (!field) return ""
  return field[lang] || field["ar"] || field["en"] || ""
}

function CategoryCard({ category, lang }: { category: Category; lang: string }) {
  const theme = useTheme()
  const name = localized(category.name, lang)
  const description = localized(category.description, lang)

  return (
    <CustomLink href={`/categories/${category.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <Card
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          height: "100%",
          transition: "all 0.3s",
          "&:hover": {
            borderColor: alpha(theme.palette.primary.main, 0.4),
            boxShadow: 4,
            transform: "translateY(-3px)",
          },
        }}
      >
        {/* Image */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            paddingTop: "65%",
            bgcolor: "grey.100",
          }}
        >
          {category.image ? (
            <Image
              src={getBackendUri(category.image)}
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
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              }}
            >
              <Typography variant="h3" fontWeight={700} color="primary" sx={{ opacity: 0.3 }}>
                {name.charAt(0).toUpperCase()}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Body */}
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              {name}
            </Typography>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.3s",
                ".MuiCard-root:hover &": {
                  bgcolor: theme.palette.primary.main,
                  color: "#fff",
                },
              }}
            >
              <ChevronRight size={14} color="inherit" />
            </Box>
          </Box>

          {description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.6,
              }}
            >
              {description}
            </Typography>
          )}
        </Box>
      </Card>
    </CustomLink>
  )
}

function SkeletonCard() {
  return (
    <Box sx={{ borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
      <Skeleton variant="rectangular" width="100%" sx={{ paddingTop: "65%" }} />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        <Skeleton variant="text" width="55%" height={24} />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="65%" />
      </Box>
    </Box>
  )
}

export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const theme = useTheme()

  const { data, isLoading } = useCategoriesQuery()
  const categories = (data ?? [])
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order)

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Hero */}
      <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", py: 7, px: 2 }}>
        <Box sx={{ maxWidth: 1200, mx: "auto" }}>
          {/* Breadcrumb */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 3 }}>
            <CustomLink
              href="/"
              style={{ color: "inherit", textDecoration: "none", fontSize: 14, opacity: 0.6 }}
            >
              {t("home")}
            </CustomLink>
            <ChevronRight size={14} style={{ opacity: 0.5 }} />
            <Typography variant="body2" sx={{ opacity: 1 }}>
              {t("categories")}
            </Typography>
          </Box>

          <Typography variant="h3" fontWeight={800} gutterBottom>
            {t("categories")}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.75 }}>
            {t("browseProductsSubtitle")}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 6 }}>
        {/* Empty state */}
        {!isLoading && categories.length === 0 && (
          <Box
            sx={{
              py: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              color: "text.disabled",
            }}
          >
            <LayoutGrid size={56} strokeWidth={1} />
            <Typography variant="body1" fontWeight={500}>
              {t("noData")}
            </Typography>
          </Box>
        )}

        {/* Grid */}
        {(isLoading || categories.length > 0) && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 3,
            }}
          >
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : categories.map((category) => (
                  <CategoryCard key={category._id} category={category} lang={lang} />
                ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
