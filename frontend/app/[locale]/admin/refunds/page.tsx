"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Box, Button, Stack, Tab, TablePagination, Tabs, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useRefundsQuery } from "@/backend-api/refunds/hooks";
import { REFUND_STATUSES, Refund, RefundFilters, RefundStatus } from "@/backend-api/refunds/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import RefundStatusChip from "@/features/Refund/RefundStatusChip";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";

const name = (who?: { name: string } | string) => (typeof who === "object" ? who?.name : undefined);

/** The refund queue: what is waiting to be approved or paid out. Each refund is acted on from its order. */
const RefundsPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const currency = useCurrency();

  const [filters, setFilters] = useState<RefundFilters>({ status: "requested", page: 1, limit: 25 });
  const { data, isLoading } = useRefundsQuery(filters);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("refunds") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "number",
        header: t("refund"),
        render: (row: Refund) => (
          <Stack>
            <Typography variant="body2" fontWeight={700}>
              {t("refundNumber", { number: row.refundNumber })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(row.executedAt ?? row.createdAt, lang)}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "order",
        header: t("order"),
        render: (row: Refund) => `#${row.orderNumber}${row.returnNumber ? ` · ${t("returnNumber", { number: row.returnNumber })}` : ""}`,
      },
      { id: "amount", header: t("amount"), render: (row: Refund) => formatMinorMoney(row.totalMinor, currency) },
      {
        id: "method",
        header: t("refundMethodLabel"),
        render: (row: Refund) => (
          <Stack>
            <Typography variant="body2">{t(`refundMethod.${row.method}`)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`refundReason.${row.reason}`)}
              {row.beyondPolicy ? ` · ${t("beyondPolicy")}` : ""}
            </Typography>
          </Stack>
        ),
      },
      { id: "requestedBy", header: t("requestedBy"), render: (row: Refund) => name(row.requestedBy) ?? "—" },
      { id: "status", header: t("status"), render: (row: Refund) => <RefundStatusChip status={row.status} /> },
      {
        id: "actions",
        header: "",
        render: (row: Refund) => (
          <Button size="small" onClick={() => router.push(`/${lang}/admin/orders/${row.order}`)}>
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, router, currency],
  );

  return (
    <Stack spacing={2} height="100%">
      <Tabs
        value={filters.status ?? "all"}
        onChange={(_, value: RefundStatus | "all") =>
          setFilters((prev) => ({ ...prev, status: value === "all" ? undefined : value, page: 1 }))
        }
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {REFUND_STATUSES.map((status) => (
          <Tab key={status} value={status} label={`${t(`refundStatus.${status}`)}${data ? ` (${data.statusCounts[status]})` : ""}`} />
        ))}
        <Tab value="all" label={t("all")} />
      </Tabs>

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data?.data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={(filters.page ?? 1) - 1}
        onPageChange={(_, page) => setFilters((prev) => ({ ...prev, page: page + 1 }))}
        rowsPerPage={filters.limit ?? 25}
        onRowsPerPageChange={(e) => setFilters((prev) => ({ ...prev, limit: parseInt(e.target.value, 10), page: 1 }))}
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Stack>
  );
};

export default RefundsPage;
