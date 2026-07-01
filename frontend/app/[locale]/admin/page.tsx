"use client";

import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ViewCarouselOutlined from "@mui/icons-material/ViewCarouselOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import AccountTreeOutlined from "@mui/icons-material/AccountTreeOutlined";
import ViewQuiltOutlined from "@mui/icons-material/ViewQuiltOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import { useBannersQuery } from "@/backend-api/banners/hooks";
import { useProductsQuery } from "@/backend-api/products/hooks";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks";
import { useSectionsQuery } from "@/backend-api/sections/hooks";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import type { LocalizedField } from "@/backend-api/globalTypes";

export const dynamic = "force-dynamic";

const ACTIVE_COLOR = "#2e7d32";
const INACTIVE_COLOR = "#c62828";

const localized = (field: LocalizedField | undefined, lang: string): string => {
  if (!field) return "";
  return field[lang] ?? field.en ?? Object.values(field).find(Boolean) ?? "";
};

const StatCard = ({
  label,
  total,
  active,
  inactive,
  icon: Icon,
  color,
  href,
  loading,
}: {
  label: string;
  total: number;
  active?: number;
  inactive?: number;
  icon: React.ElementType;
  color: string;
  href: string;
  loading: boolean;
}) => {
  const router = useRouter();
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, height: "100%", borderColor: "divider" }}
    >
      <CardActionArea onClick={() => router.push(href)} sx={{ height: "100%" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `${color}18`,
              }}
            >
              <Icon sx={{ fontSize: 26, color }} />
            </Box>
            {loading ? (
              <Skeleton width={50} height={40} />
            ) : (
              <Typography variant="h3" fontWeight={800} sx={{ color, lineHeight: 1 }}>
                {total}
              </Typography>
            )}
          </Stack>

          <Typography variant="subtitle2" fontWeight={700} color="text.primary" mb={1}>
            {label}
          </Typography>

          {(active !== undefined || inactive !== undefined) && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {active !== undefined && (
                <Chip
                  icon={<CheckCircleOutlined sx={{ fontSize: "14px !important" }} />}
                  label={active}
                  size="small"
                  sx={{ bgcolor: "#e8f5e9", color: ACTIVE_COLOR, fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
              {inactive !== undefined && (
                <Chip
                  icon={<CancelOutlined sx={{ fontSize: "14px !important" }} />}
                  label={inactive}
                  size="small"
                  sx={{ bgcolor: "#fce4ec", color: INACTIVE_COLOR, fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

/** Dependency-free SVG donut showing the active share of a total. */
const StatusDonut = ({ active, total }: { active: number; total: number }) => {
  const size = 168;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = total > 0 ? active / total : 0;
  const rate = Math.round(fraction * 100);

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f2" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ACTIVE_COLOR}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${fraction * c} ${c}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h4" fontWeight={800} lineHeight={1}>
          {rate}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {total}
        </Typography>
      </Box>
    </Box>
  );
};

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();

  const { data: banners, isLoading: loadingBanners } = useBannersQuery();
  const { data: products, isLoading: loadingProducts } = useProductsQuery();
  const { data: categories, isLoading: loadingCategories } = useCategoriesQuery();
  const { data: subCategories, isLoading: loadingSubCategories } = useSubCategoriesQuery();
  const { data: sections, isLoading: loadingSections } = useSectionsQuery();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("dashboard") }] }));
    return () => { dispatch(resetBreadCrumbActions()); };
  }, [dispatch, t]);

  const productList = useMemo(() => products ?? [], [products]);
  const activeProducts = useMemo(
    () => productList.filter((p) => p.isActive).length,
    [productList],
  );

  const countActive = <T extends { isActive: boolean }>(items?: T[]) =>
    (items ?? []).filter((i) => i.isActive).length;

  // Products grouped by category, top 6 by count.
  const byCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of productList) {
      const name = localized(p.category?.name, lang) || t("uncategorized");
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [productList, lang, t]);

  const maxCategoryCount = byCategory[0]?.count ?? 0;

  const stats = [
    {
      label: t("products"),
      total: productList.length,
      active: activeProducts,
      inactive: productList.length - activeProducts,
      icon: Inventory2Outlined,
      color: "#6366f1",
      href: `/${lang}/admin/products`,
      loading: loadingProducts,
    },
    {
      label: t("categories"),
      total: (categories ?? []).length,
      active: countActive(categories),
      inactive: (categories ?? []).length - countActive(categories),
      icon: CategoryOutlined,
      color: "#0891b2",
      href: `/${lang}/admin/categories`,
      loading: loadingCategories,
    },
    {
      label: t("subCategories"),
      total: (subCategories ?? []).length,
      active: countActive(subCategories),
      inactive: (subCategories ?? []).length - countActive(subCategories),
      icon: AccountTreeOutlined,
      color: "#7c3aed",
      href: `/${lang}/admin/sub-categories`,
      loading: loadingSubCategories,
    },
    {
      label: t("sections"),
      total: (sections ?? []).length,
      icon: ViewQuiltOutlined,
      color: "#ea580c",
      href: `/${lang}/admin/sections`,
      loading: loadingSections,
    },
    {
      label: t("banners"),
      total: (banners ?? []).length,
      icon: ViewCarouselOutlined,
      color: "#e11d48",
      href: `/${lang}/admin/banners`,
      loading: loadingBanners,
    },
  ];

  const inactiveProducts = productList.length - activeProducts;

  return (
    <Container maxWidth="xl" disableGutters>
      <Stack spacing={4}>
        {/* Stat cards */}
        <Grid container spacing={3}>
          {stats.map((stat) => (
            <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <StatCard {...stat} />
            </Grid>
          ))}
        </Grid>

        {/* Catalog overview */}
        <Grid container spacing={3}>
          {/* Product status donut */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={800} mb={0.5}>
                  {t("productStatus")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("activeRate")}
                </Typography>

                <Stack alignItems="center" spacing={2.5} mt={2}>
                  {loadingProducts ? (
                    <Skeleton variant="circular" width={168} height={168} />
                  ) : (
                    <StatusDonut active={activeProducts} total={productList.length} />
                  )}

                  <Stack direction="row" spacing={3}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: ACTIVE_COLOR }} />
                      <Typography variant="body2" color="text.secondary">
                        {t("active")}
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {activeProducts}
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: INACTIVE_COLOR }} />
                      <Typography variant="body2" color="text.secondary">
                        {t("inactive")}
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {inactiveProducts}
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Products by category */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", borderColor: "divider" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={800} mb={2}>
                  {t("productsByCategory")}
                </Typography>

                {loadingProducts ? (
                  <Stack spacing={2}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} height={28} />
                    ))}
                  </Stack>
                ) : byCategory.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                    {t("noData")}
                  </Typography>
                ) : (
                  <Stack spacing={2.25}>
                    {byCategory.map((row) => (
                      <Box key={row.label}>
                        <Stack direction="row" justifyContent="space-between" mb={0.75}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: "80%" }}>
                            {row.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={700} color="text.secondary">
                            {row.count}
                          </Typography>
                        </Stack>
                        <Box sx={{ height: 8, borderRadius: 999, bgcolor: "#eef0f2", overflow: "hidden" }}>
                          <Box
                            sx={{
                              height: "100%",
                              borderRadius: 999,
                              width: `${maxCategoryCount ? (row.count / maxCategoryCount) * 100 : 0}%`,
                              background: "linear-gradient(90deg, #6366f1, #0891b2)",
                              transition: "width 600ms ease",
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
};

export default Dashboard;
