"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { exportOrdersCsv } from "@/backend-api/orders/queries";
import { datedFilename, downloadFile } from "@/utils/downloadFile";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useOrdersQuery } from "@/backend-api/orders/hooks";
import { useOnlinePaymentAvailableQuery } from "@/backend-api/payments/hooks";
import {
  ORDER_STATUSES,
  Order,
  OrderFilters,
} from "@/backend-api/orders/types";
import { useCurrency } from "@/Hooks/useCurrency";
import PageActions, { PageActionButton } from "@/components/PageActions";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import SimpleTable from "@/components/Table/SimpleTable";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import {
  formatDateTime,
  formatMoney,
  localized,
} from "@/features/Order/format";

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
      () =>
        setFilters((prev) => ({
          ...prev,
          search: search || undefined,
          page: 1,
        })),
      350,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useOrdersQuery(filters);
  const { data: onlineAvailable } = useOnlinePaymentAvailableQuery();

  const patch = (next: Partial<OrderFilters>) =>
    setFilters((prev) => ({ ...prev, ...next, page: 1 }));

  // Calendar days in the browser's zone; the server reads them in the store's zone.
  const datePresets = useMemo(() => {
    const iso = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    const now = new Date();
    const ago = (days: number) =>
      iso(new Date(now.getTime() - days * 86400000));
    return [
      { key: "today", label: t("today"), from: iso(now), to: iso(now) },
      { key: "7", label: t("last7Days"), from: ago(6), to: iso(now) },
      { key: "30", label: t("last30Days"), from: ago(29), to: iso(now) },
      {
        key: "month",
        label: t("thisMonth"),
        from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: iso(now),
      },
    ];
  }, [t]);

  const clearAll = () => {
    setSearch("");
    setFilters((prev) => ({ page: 1, limit: prev.limit }));
  };

  const chips = [
    ...(filters.status
      ? [
          {
            key: "status",
            label: t(`orderStatus.${filters.status}`),
            onDelete: () => patch({ status: undefined }),
          },
        ]
      : []),
    ...(filters.paymentMethod
      ? [
          {
            key: "pay",
            label: t(`paymentMethods.${filters.paymentMethod}`),
            onDelete: () => patch({ paymentMethod: undefined }),
          },
        ]
      : []),
    ...(filters.from || filters.to
      ? [
          {
            key: "date",
            label: `${filters.from ?? "…"} → ${filters.to ?? "…"}`,
            onDelete: () => patch({ from: undefined, to: undefined }),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: "search",
            label: `${t("search")}: ${search}`,
            onDelete: () => setSearch(""),
          },
        ]
      : []),
  ];
  const activeCount = chips.length;

  // Everything matching the current filters, not just this page.
  const exportMutation = useMutation({
    mutationFn: () =>
      exportOrdersCsv(
        {
          status: filters.status,
          search: filters.search,
          from: filters.from,
          to: filters.to,
        },
        lang,
      ),
    onSuccess: (blob) => downloadFile(blob, datedFilename("orders")),
    onError: () => toast.error(t("somethingWentWrong")),
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("orders") }],
        breadCrumbBtns: [],
      }),
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
            <Typography variant="body2">
              {row.shippingAddress.fullName}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              dir="ltr"
              sx={{ textAlign: "start" }}
            >
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
              <Typography variant="body2">
                {localized(a.subZoneName, lang)}
              </Typography>
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
        render: (row: Order) =>
          row.items.reduce((sum, i) => sum + i.quantity, 0),
      },
      {
        id: "total",
        header: t("total"),
        render: (row: Order) => (
          <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
            {formatMoney(
              row.total,
              localized(row.currency, lang) || fallbackCurrency,
            )}
          </Typography>
        ),
      },
      ...(onlineAvailable
        ? [
            {
              id: "paymentMethod",
              header: t("paymentMethod"),
              render: (row: Order) => (
                <Chip
                  size="small"
                  color={row.paymentMethod === "online" ? "info" : "default"}
                  label={t(
                    `paymentMethods.${row.paymentMethod ?? "cash_on_delivery"}`,
                  )}
                />
              ),
            },
          ]
        : []),
      {
        id: "status",
        header: t("status"),
        render: (row: Order) => (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <OrderStatusChip status={row.status} />
            {row.preorder && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t("preorder")}
              />
            )}
          </Stack>
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: Order) => (
          <Button
            size="small"
            onClick={() => router.push(`/${lang}/admin/orders/${row._id}`)}
          >
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, router, fallbackCurrency, onlineAvailable],
  );

  return (
    <>
      <PageActions>
        <PageActionButton
          startIcon={<FileDownloadOutlined />}
          disabled={exportMutation.isPending || !data?.total}
          onClick={() => exportMutation.mutate()}
        >
          {t("exportCsv")}
        </PageActionButton>
      </PageActions>
      <FilterLayout
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("orderSearchPlaceholder"),
        }}
        activeCount={activeCount}
        chips={chips}
        onClear={clearAll}
        filters={
          <>
            <FilterSelect
              label={t("status")}
              value={filters.status}
              onChange={(status) => patch({ status })}
              options={ORDER_STATUSES.map((s) => ({
                value: s,
                label: t(`orderStatus.${s}`),
              }))}
            />

            {onlineAvailable && (
              <FilterSelect
                label={t("paymentMethod")}
                value={filters.paymentMethod}
                onChange={(paymentMethod) => patch({ paymentMethod })}
                options={[
                  { value: "online", label: t("paymentMethods.online") },
                  {
                    value: "cash_on_delivery",
                    label: t("paymentMethods.cash_on_delivery"),
                  },
                ]}
              />
            )}

            <FilterSelect
              label={t("dateRange")}
              value={
                datePresets.find(
                  (p) => p.from === filters.from && p.to === filters.to,
                )?.key
              }
              onChange={(key) => {
                const p = datePresets.find((d) => d.key === key);
                patch({ from: p?.from, to: p?.to });
              }}
              options={datePresets.map((p) => ({
                value: p.key,
                label: p.label,
              }))}
            />
            <Stack direction="row" gap={1}>
              <TextField
                size="small"
                type="date"
                label={t("from")}
                value={filters.from ?? ""}
                onChange={(e) => patch({ from: e.target.value || undefined })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                type="date"
                label={t("to")}
                value={filters.to ?? ""}
                onChange={(e) => patch({ to: e.target.value || undefined })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </>
        }
      >
        <SimpleTable
          columns={columns}
          data={data?.data ?? []}
          height="100%"
          loading={isLoading}
          onRowClick={(row: Order) =>
            router.push(`/${lang}/admin/orders/${row._id}`)
          }
          pagination={{
            count: data?.total ?? 0,
            page: (filters.page ?? 1) - 1,
            rowsPerPage: filters.limit ?? 25,
            onPageChange: (page) =>
              setFilters((prev) => ({ ...prev, page: page + 1 })),
            onRowsPerPageChange: (limit) =>
              setFilters((prev) => ({ ...prev, limit, page: 1 })),
          }}
        />
      </FilterLayout>
    </>
  );
};

export default OrdersPage;
