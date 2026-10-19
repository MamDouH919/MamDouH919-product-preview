"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { exportOrdersCsv } from "@/backend-api/orders/queries";
import { datedFilename, downloadFile } from "@/utils/downloadFile";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useOrdersQuery } from "@/backend-api/orders/hooks";
import { ORDER_STATUSES, Order, OrderFilters, OrderStatus } from "@/backend-api/orders/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import { formatDateTime, formatMoney, localized } from "@/features/Order/format";

const OrdersPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const fallbackCurrency = useCurrency();

  const [filters, setFilters] = useState<OrderFilters>({ page: 1, limit: 25 });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 })),
      350
    );
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useOrdersQuery(filters);

  // Everything matching the current filters, not just this page.
  const exportMutation = useMutation({
    mutationFn: () =>
      exportOrdersCsv({ status: filters.status, search: filters.search, from: filters.from, to: filters.to }, lang),
    onSuccess: (blob) => downloadFile(blob, datedFilename("orders")),
    onError: () => toast.error(t("somethingWentWrong")),
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("orders") }],
        breadCrumbBtns: [],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "orderNumber",
        header: t("order"),
        render: (row: Order) => (
          <Stack>
            <Typography variant="body2" fontWeight={700}>
              #{row.orderNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(row.createdAt, lang)}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "customer",
        header: t("customer"),
        render: (row: Order) => (
          <Stack>
            <Typography variant="body2">{row.shippingAddress.fullName}</Typography>
            <Typography variant="caption" color="text.secondary" dir="ltr" sx={{ textAlign: "start" }}>
              {row.shippingAddress.phone}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "city",
        header: t("deliveryArea"),
        render: (row: Order) => {
          const a = row.shippingAddress;
          if (!a.subZoneName) return a.city;
          return (
            <Stack>
              <Typography variant="body2">{localized(a.subZoneName, lang)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {localized(a.zoneName, lang)}
              </Typography>
            </Stack>
          );
        },
      },
      {
        id: "items",
        header: t("items"),
        render: (row: Order) => row.items.reduce((sum, i) => sum + i.quantity, 0),
      },
      {
        id: "total",
        header: t("total"),
        render: (row: Order) => (
          <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
            {formatMoney(row.total, localized(row.currency, lang) || fallbackCurrency)}
          </Typography>
        ),
      },
      {
        id: "status",
        header: t("status"),
        render: (row: Order) => <OrderStatusChip status={row.status} />,
      },
      {
        id: "actions",
        header: "",
        render: (row: Order) => (
          <Button size="small" onClick={() => router.push(`/${lang}/admin/orders/${row._id}`)}>
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, router, fallbackCurrency]
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          label={t("search")}
          placeholder={t("orderSearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <TextField
          select
          size="small"
          label={t("status")}
          value={filters.status ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              status: (e.target.value || undefined) as OrderStatus | undefined,
              page: 1,
            }))
          }
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {ORDER_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {t(`orderStatus.${status}`)}
            </MenuItem>
          ))}
        </TextField>
        <Box flex={1} />
        <Button
          startIcon={<FileDownloadOutlined />}
          disabled={exportMutation.isPending || !data?.total}
          onClick={() => exportMutation.mutate()}
          sx={{ alignSelf: "center" }}
        >
          {t("exportCsv")}
        </Button>
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable
          columns={columns}
          data={data?.data ?? []}
          borderRadius={0}
          height="100%"
          loading={isLoading}
        />
      </Box>

      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={(filters.page ?? 1) - 1}
        onPageChange={(_, page) => setFilters((prev) => ({ ...prev, page: page + 1 }))}
        rowsPerPage={filters.limit ?? 25}
        onRowsPerPageChange={(e) =>
          setFilters((prev) => ({ ...prev, limit: parseInt(e.target.value, 10), page: 1 }))
        }
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Stack>
  );
};

export default OrdersPage;
