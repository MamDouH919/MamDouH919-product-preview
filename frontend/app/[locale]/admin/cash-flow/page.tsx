"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Box, Button, Card, CardContent, Chip, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useCashFlowQuery } from "@/backend-api/reports/hooks";
import { CashFlowEntry, DashboardPeriod } from "@/backend-api/reports/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatDateTime, formatMoney } from "@/features/Order/format";

const PERIODS: DashboardPeriod[] = [7, 30, 90];

const Figure = ({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) => (
  <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
    <CardContent sx={{ p: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} color={color} mt={0.5}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </CardContent>
  </Card>
);

/**
 * Money in and out for a store with stock but no books: what delivered orders
 * brought in and what settled returns gave back. Not accounting, just the till.
 */
const CashFlowPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const currency = useCurrency();
  const [days, setDays] = useState<DashboardPeriod>(30);
  const { data, isLoading } = useCashFlowQuery(days);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("cashFlow") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "date",
        header: t("date"),
        render: (row: CashFlowEntry) => formatDateTime(row.at, lang),
      },
      {
        id: "type",
        header: t("cashFlowType"),
        render: (row: CashFlowEntry) => (
          <Chip size="small" color={row.type === "in" ? "success" : "warning"} variant="outlined" label={t(row.type === "in" ? "cashIn" : "cashOut")} />
        ),
      },
      {
        id: "source",
        header: t("order"),
        render: (row: CashFlowEntry) =>
          row.type === "in" ? `#${row.orderNumber}` : `#${row.orderNumber} · ${t("returnNumber", { number: row.returnNumber })}`,
      },
      {
        id: "amount",
        header: t("amount"),
        render: (row: CashFlowEntry) => (
          <Typography variant="body2" fontWeight={700} color={row.type === "in" ? "success.main" : "warning.main"}>
            {row.type === "in" ? "+" : "−"} {formatMoney(row.amount, currency)}
          </Typography>
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: CashFlowEntry) => (
          <Button size="small" onClick={() => router.push(`/${lang}/admin/${row.type === "out" ? `returns/${row.returnId}` : `orders/${row.orderId}`}`)}>
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, router, currency],
  );

  const totals = data?.totals;

  return (
    <Stack spacing={3} py={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Typography variant="body2" color="text.secondary" maxWidth={560}>
          {t("cashFlowHint")}
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={days} onChange={(_, value) => value && setDays(value)}>
          {PERIODS.map((p) => (
            <ToggleButton key={p} value={p}>
              {t("lastNDays", { count: p })}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Figure
            label={t("cashIn")}
            value={formatMoney(totals?.in ?? 0, currency)}
            hint={t("cashInHint", { count: totals?.orders ?? 0 })}
            color="success.main"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Figure
            label={t("cashOut")}
            value={formatMoney(totals?.out ?? 0, currency)}
            hint={t("cashOutHint", { count: totals?.returns ?? 0 })}
            color="warning.main"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Figure label={t("cashNet")} value={formatMoney(totals?.net ?? 0, currency)} />
        </Grid>
      </Grid>

      <Box>
        <SimpleTable columns={columns} data={data?.entries ?? []} borderRadius={2} loading={isLoading} />
      </Box>
    </Stack>
  );
};

export default CashFlowPage;
