"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import RateReviewOutlined from "@mui/icons-material/RateReviewOutlined";
import CustomLink from "@/components/CustomLink";
import { useDashboardReportQuery } from "@/backend-api/reports/hooks";
import { DashboardPeriod } from "@/backend-api/reports/types";
import { useLowStockQuery } from "@/backend-api/inventory/hooks";
import { ORDER_STATUSES } from "@/backend-api/orders/types";
import { useCurrency } from "@/Hooks/useCurrency";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import { formatDateTime, formatMoney, localized } from "@/features/Order/format";
import { getBackendUri } from "@/utils/helperFunctions";
import RevenueChart from "./RevenueChart";

const PERIODS: DashboardPeriod[] = [7, 30, 90];

const cardSx = { borderRadius: 3, height: "100%", borderColor: "divider" } as const;

const SectionCard = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card variant="outlined" sx={cardSx}>
    <CardContent sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={1}>
        <Typography variant="subtitle1" fontWeight={800}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </CardContent>
  </Card>
);

/** Change against the previous period. No arrow at all when there's nothing to compare with. */
const Delta = ({ current, previous }: { current: number; previous: number }) => {
  const { t } = useTranslation();
  if (previous === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {current > 0 ? t("noPriorData") : "—"}
      </Typography>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  const Icon = up ? ArrowUpward : ArrowDownward;
  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      <Icon sx={{ fontSize: 14, color: up ? "success.main" : "error.main" }} />
      <Typography variant="caption" fontWeight={700} color={up ? "success.main" : "error.main"}>
        {Math.abs(change).toFixed(change !== 0 && Math.abs(change) < 10 ? 1 : 0)}%
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("vsPreviousPeriod")}
      </Typography>
    </Stack>
  );
};

const KpiTile = ({
  label,
  value,
  footer,
  loading,
}: {
  label: string;
  value: string;
  footer: React.ReactNode;
  loading: boolean;
}) => (
  <Card variant="outlined" sx={cardSx}>
    <CardContent sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary" fontWeight={600} mb={1}>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width="60%" height={40} />
      ) : (
        <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: "tabular-nums" }} noWrap>
          {value}
        </Typography>
      )}
      <Box mt={1} minHeight={20}>
        {!loading && footer}
      </Box>
    </CardContent>
  </Card>
);

const ViewAll = ({ href }: { href: string }) => {
  const { t } = useTranslation();
  return (
    <CustomLink href={href}>
      <Typography variant="body2" color="primary" fontWeight={600}>
        {t("viewAll")}
      </Typography>
    </CustomLink>
  );
};

const EmptyRow = ({ text }: { text: string }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
    {text}
  </Typography>
);

/**
 * The top of the admin home page: how the store is selling. Renders nothing
 * for an admin without the orders permission rather than an error.
 */
const SalesOverview = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = useCurrency();
  const [days, setDays] = useState<DashboardPeriod>(30);

  const { data, isLoading, isError } = useDashboardReportQuery(days);
  const { data: lowStock, isError: lowStockHidden } = useLowStockQuery();

  if (isError) return null;

  const money = (amount: number) => formatMoney(Math.round(amount * 100) / 100, currency);
  const lowStockRows = (lowStock ?? []).slice(0, 6);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            {t("salesOverview")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("salesOverviewHint")}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
          {!!data?.pendingReviews && (
            <CustomLink href="/admin/reviews">
              <Chip
                clickable
                icon={<RateReviewOutlined />}
                color="warning"
                variant="outlined"
                label={t("pendingReviewsCount", { count: data.pendingReviews })}
              />
            </CustomLink>
          )}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={days}
            onChange={(_, value: DashboardPeriod | null) => value && setDays(value)}
          >
            {PERIODS.map((period) => (
              <ToggleButton key={period} value={period} sx={{ px: 1.5, fontWeight: 700 }}>
                {t("lastNDays", { count: period })}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* KPIs */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            label={t("revenue")}
            value={money(data?.current.revenue ?? 0)}
            loading={isLoading}
            footer={data && <Delta current={data.current.revenue} previous={data.previous.revenue} />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            label={t("orders")}
            value={(data?.current.orders ?? 0).toLocaleString()}
            loading={isLoading}
            footer={data && <Delta current={data.current.orders} previous={data.previous.orders} />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            label={t("averageOrderValue")}
            value={money(data?.current.averageOrderValue ?? 0)}
            loading={isLoading}
            footer={
              data && (
                <Delta current={data.current.averageOrderValue} previous={data.previous.averageOrderValue} />
              )
            }
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile
            label={t("today")}
            value={money(data?.today.revenue ?? 0)}
            loading={isLoading}
            footer={
              data && (
                <Typography variant="caption" color="text.secondary">
                  {t("ordersCount", { count: data.today.orders })} · {t("newCustomersCount", { count: data.newCustomers })}
                </Typography>
              )
            }
          />
        </Grid>
      </Grid>

      {/* Revenue over time + where orders stand */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title={t("revenueByDay")}>
            {isLoading || !data ? (
              <Skeleton variant="rounded" height={244} />
            ) : (
              <RevenueChart series={data.series} currency={currency} />
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard
            title={t("ordersByStatus")}
            action={
              <ViewAll href="/admin/orders" />
            }
          >
            <Stack spacing={1.5}>
              {ORDER_STATUSES.map((status) => (
                <Stack key={status} direction="row" alignItems="center" justifyContent="space-between">
                  <OrderStatusChip status={status} />
                  {isLoading || !data ? (
                    <Skeleton width={32} />
                  ) : (
                    <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {data.statusCounts[status].toLocaleString()}
                    </Typography>
                  )}
                </Stack>
              ))}
              {!!data?.current.cancelled && (
                <Typography variant="caption" color="text.secondary" pt={1}>
                  {t("cancelledInPeriod", { count: data.current.cancelled })}
                </Typography>
              )}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Lists */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, lg: lowStockHidden ? 6 : 4 }}>
          <SectionCard title={t("topProducts")}>
            {isLoading || !data ? (
              <Stack spacing={1.5}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={40} />
                ))}
              </Stack>
            ) : data.topProducts.length === 0 ? (
              <EmptyRow text={t("noSalesInPeriod")} />
            ) : (
              <Stack spacing={1.5}>
                {data.topProducts.map((row, i) => (
                  <Stack key={row.productId} direction="row" alignItems="center" spacing={1.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} width={14}>
                      {i + 1}
                    </Typography>
                    <Avatar variant="rounded" src={row.image ? getBackendUri(row.image) : undefined} sx={{ width: 40, height: 40 }}>
                      {localized(row.name, lang).charAt(0)}
                    </Avatar>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {localized(row.name, lang)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("unitsSold", { count: row.quantity })}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} whiteSpace="nowrap">
                      {money(row.revenue)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        {!lowStockHidden && (
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <SectionCard
              title={t("lowStock")}
              action={
                <ViewAll href="/admin/inventory" />
              }
            >
              {!lowStock ? (
                <Stack spacing={1.5}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={40} />
                  ))}
                </Stack>
              ) : lowStockRows.length === 0 ? (
                <EmptyRow text={t("allStockedUp")} />
              ) : (
                <Stack spacing={1.5}>
                  {lowStockRows.map((row) => (
                    <Stack key={`${row.productId}-${row.variantId ?? ""}`} direction="row" alignItems="center" spacing={1.5}>
                      <Avatar variant="rounded" src={row.image ? getBackendUri(row.image) : undefined} sx={{ width: 40, height: 40 }}>
                        {localized(row.name, lang).charAt(0)}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {localized(row.name, lang)}
                        </Typography>
                        {row.variantLabel && (
                          <Typography variant="caption" color="text.secondary">
                            {row.variantLabel}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        size="small"
                        color={row.status === "out" ? "error" : "warning"}
                        label={row.status === "out" ? t("outOfStock") : t("unitsLeft", { count: row.stock })}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Grid>
        )}

        <Grid size={{ xs: 12, lg: lowStockHidden ? 6 : 4 }}>
          <SectionCard
            title={t("recentOrders")}
            action={
              <ViewAll href="/admin/orders" />
            }
          >
            {isLoading || !data ? (
              <Stack spacing={1.5}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={40} />
                ))}
              </Stack>
            ) : data.recentOrders.length === 0 ? (
              <EmptyRow text={t("noRecentOrders")} />
            ) : (
              <Stack spacing={1.5}>
                {data.recentOrders.map((order) => (
                  <CustomLink key={order._id} href={`/admin/orders/${order._id}`}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={700}>
                          #{order.orderNumber}{" "}
                          <Typography component="span" variant="body2" color="text.secondary" fontWeight={400}>
                            {order.shippingAddress?.fullName}
                          </Typography>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(order.createdAt, lang)}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5}>
                        <Typography variant="body2" fontWeight={700} whiteSpace="nowrap">
                          {formatMoney(order.total, localized(order.currency, lang) || currency)}
                        </Typography>
                        <OrderStatusChip status={order.status} />
                      </Stack>
                    </Stack>
                  </CustomLink>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default SalesOverview;
