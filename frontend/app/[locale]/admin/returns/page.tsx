"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Box, Button, Stack, Tab, TablePagination, Tabs, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useReturnsQuery } from "@/backend-api/returns/hooks";
import { RETURN_STATUSES, ReturnFilters, ReturnRequest, ReturnStatus } from "@/backend-api/returns/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import ReturnStatusChip from "@/features/Return/ReturnStatusChip";
import { formatDateTime, formatMoney } from "@/features/Order/format";

const ReturnsPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const currency = useCurrency();

  // Open requests first: that's the queue someone comes here to work through.
  const [filters, setFilters] = useState<ReturnFilters>({ status: "requested", page: 1, limit: 25 });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useReturnsQuery(filters);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("returns") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "number",
        header: t("return"),
        render: (row: ReturnRequest) => (
          <Stack>
            <Typography variant="body2" fontWeight={700}>
              {t("returnNumber", { number: row.returnNumber })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(row.createdAt, lang)}
            </Typography>
          </Stack>
        ),
      },
      { id: "order", header: t("order"), render: (row: ReturnRequest) => `#${row.orderNumber}` },
      {
        id: "customer",
        header: t("customer"),
        render: (row: ReturnRequest) =>
          typeof row.customer === "object" ? (
            <Stack>
              <Typography variant="body2">{row.customer.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {row.customer.email}
              </Typography>
            </Stack>
          ) : (
            "—"
          ),
      },
      { id: "items", header: t("items"), render: (row: ReturnRequest) => row.items.reduce((s, i) => s + i.quantity, 0) },
      { id: "reason", header: t("returnReasonLabel"), render: (row: ReturnRequest) => t(`returnReason.${row.reason}`) },
      {
        id: "refund",
        header: t("refund"),
        render: (row: ReturnRequest) => (row.refundAmount != null ? formatMoney(row.refundAmount, currency) : "—"),
      },
      { id: "status", header: t("status"), render: (row: ReturnRequest) => <ReturnStatusChip status={row.status} /> },
      {
        id: "actions",
        header: "",
        render: (row: ReturnRequest) => (
          <Button size="small" onClick={() => router.push(`/${lang}/admin/returns/${row._id}`)}>
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, router, currency]
  );

  return (
    <Stack spacing={2} height="100%">
      <Tabs
        value={filters.status ?? "all"}
        onChange={(_, value: ReturnStatus | "all") =>
          setFilters((prev) => ({ ...prev, status: value === "all" ? undefined : value, page: 1 }))
        }
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {RETURN_STATUSES.map((status) => (
          <Tab key={status} value={status} label={`${t(`returnStatus.${status}`)}${data ? ` (${data.statusCounts[status]})` : ""}`} />
        ))}
        <Tab value="all" label={t("all")} />
      </Tabs>

      <TextField
        size="small"
        label={t("search")}
        placeholder={t("returnSearchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ maxWidth: 280 }}
      />

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

export default ReturnsPage;
