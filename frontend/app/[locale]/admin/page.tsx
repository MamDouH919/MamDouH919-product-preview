"use client";

import { useEffect } from "react";
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
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import { useBannersQuery } from "@/backend-api/banners/hooks";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";

export const dynamic = "force-dynamic";

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
                  sx={{ bgcolor: "#e8f5e9", color: "#2e7d32", fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
              {inactive !== undefined && (
                <Chip
                  icon={<CancelOutlined sx={{ fontSize: "14px !important" }} />}
                  label={inactive}
                  size="small"
                  sx={{ bgcolor: "#fce4ec", color: "#c62828", fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();

  const { data: banners, isLoading: loadingBanners } = useBannersQuery();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("dashboard") }] }));
    return () => { dispatch(resetBreadCrumbActions()); };
  }, [dispatch, t]);



  const stats = [
    {
      label: t("banners"),
      total: (banners ?? []).length,
      icon: ViewCarouselOutlined,
      color: "#e11d48",
      href: `/${lang}/admin/banners`,
      loading: loadingBanners,
    },
  ];

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

      </Stack>
    </Container>
  );
};

export default Dashboard;
