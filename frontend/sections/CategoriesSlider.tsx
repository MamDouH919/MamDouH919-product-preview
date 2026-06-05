"use client"

import { useRef } from "react"
import { useCategoriesQuery } from "@/backend-api/categories/hooks"
import { getBackendUri } from "@/utils/helperFunctions"
import { useTranslation } from "react-i18next"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import { useTheme } from "@mui/material/styles"
import Image from "next/image"
import { Container } from "@mui/material"
import CustomLink from "@/components/CustomLink"

export default function CategoriesSlider() {
  const { data, isLoading } = useCategoriesQuery()
  const { i18n, t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()

  const categories = (data ?? [])
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order)

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", gap: 2, px: 2, overflow: "hidden", justifyContent: { xs: "flex-start", sm: "center" } }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <Skeleton variant="rectangular" width={80} height={80} sx={{ borderRadius: 1 }} />
            <Skeleton variant="text" width={56} height={14} />
          </Box>
        ))}
      </Box>
    )
  }

  if (!categories.length) return null

  return (
    <Container>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, px: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 4, height: 24, borderRadius: 99, bgcolor: "primary.main" }} />
          <Typography variant="h6" fontWeight={700} color="text.primary">
            {t("categories")}
          </Typography>
        </Box>
        <CustomLink href="/categories" style={{ color: theme.palette.primary.main, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
          {t("viewAll")}
        </CustomLink>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          display: "flex",
          gap: 2,
          px: 2,
          overflowX: "auto",
          justifyContent: { xs: "flex-start", sm: "center" },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {categories.map((category) => {
          const name =
            category.name[i18n.language] ||
            category.name["ar"] ||
            category.name["en"] ||
            ""

          return (
            <Card
              key={category._id}
              elevation={0}
              sx={{
                flexShrink: 0,
                border: "2px solid transparent",
                borderRadius: 1,
                transition: "border-color 0.3s",
                "&:hover": { borderColor: theme.palette.primary.main },
              }}
            >
              <CardActionArea
                href={`/categories/${category.slug}`}
                sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, p: 1 }}
              >
                <Box
                  sx={{
                    width: 150,
                    height: 150,
                    position: "relative",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "grey.100",
                    flexShrink: 0,
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
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "grey.200",
                      }}
                    >
                      <Typography variant="h5" fontWeight={700} color="text.disabled">
                        {name.charAt(0).toUpperCase()}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, width: "100%" }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 3,
                      borderRadius: 99,
                      bgcolor: "grey.300",
                      transition: "width 0.3s, background-color 0.3s",
                      ".MuiCardActionArea-root:hover &": {
                        width: 36,
                        bgcolor: theme.palette.primary.main,
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    textAlign="center"
                    noWrap
                    sx={{
                      maxWidth: 130,
                      color: "text.secondary",
                      transition: "color 0.3s",
                      ".MuiCardActionArea-root:hover &": { color: theme.palette.primary.main },
                    }}
                  >
                    {name}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          )
        })}
      </Box>
    </Container>
  )
}
