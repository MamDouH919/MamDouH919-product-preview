"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useReturnsQuery } from "@/backend-api/returns/hooks";
import {
  RETURN_REASONS,
  RETURN_STATUSES,
  ReturnFilters,
  ReturnRequest,
} from "@/backend-api/returns/types";
import { useCurrency } from "@/Hooks/useCurrency";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
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
  const [filters, setFilters] = useState<ReturnFilters>({
    status: "requested",
    page: 1,
    limit: 25,
  });
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

  const { data, isLoading } = useReturnsQuery(filters);

  const patch = (next: Partial<ReturnFilters>) =>
    setFilters((prev) => ({ ...prev, ...next, page: 1 }));
  const clearAll = () => {
    setSearch("");
    setFilters((prev) => ({ page: 1, limit: prev.limit }));
  };
  const chips = [
    ...(filters.status
      ? [
          {
            key: "status",
            label: t(`returnStatus.${filters.status}`),
            onDelete: () => patch({ status: undefined }),
          },
        ]
      : []),
    ...(filters.reason
      ? [
          {
            key: "reason",
            label: t(`returnReason.${filters.reason}`),
            onDelete: () => patch({ reason: undefined }),
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

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("returns") }],
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
      {
        id: "order",
        header: t("order"),
        render: (row: ReturnRequest) => `#${row.orderNumber}`,
      },
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
      {
        id: "items",
        header: t("items"),
        render: (row: ReturnRequest) =>
          row.items.reduce((s, i) => s + i.quantity, 0),
      },
      {
        id: "reason",
        header: t("returnReasonLabel"),
        render: (row: ReturnRequest) => t(`returnReason.${row.reason}`),
      },
      {
        id: "refund",
        header: t("refund"),
        render: (row: ReturnRequest) =>
          row.refundAmount != null
            ? formatMoney(row.refundAmount, currency)
            : "—",
      },
      {
        id: "status",
        header: t("status"),
        render: (row: ReturnRequest) => (
          <ReturnStatusChip status={row.status} />
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: ReturnRequest) => (
          <Button
            size="small"
            onClick={() => router.push(`/${lang}/admin/returns/${row._id}`)}
          >
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, router, currency],
  );

  return (
    <Stack spacing={2} height="100%">
      <FilterLayout
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("returnSearchPlaceholder"),
        }}
        activeCount={chips.length}
        chips={chips}
        onClear={clearAll}
        filters={
          <>
            <FilterSelect
              label={t("status")}
              value={filters.status}
              onChange={(status) => patch({ status })}
              options={RETURN_STATUSES.map((s) => ({
                value: s,
                label: `${t(`returnStatus.${s}`)}${data ? ` (${data.statusCounts[s]})` : ""}`,
              }))}
            />
            <FilterSelect
              label={t("returnReasonLabel")}
              value={filters.reason}
              onChange={(reason) => patch({ reason })}
              options={RETURN_REASONS.map((r) => ({
                value: r,
                label: t(`returnReason.${r}`),
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
        {" "}
        <SimpleTable
          columns={columns}
          data={data?.data ?? []}
          height="100%"
          loading={isLoading}
          onRowClick={(row: ReturnRequest) =>
            router.push(`/${lang}/admin/returns/${row._id}`)
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
    </Stack>
  );
};

export default ReturnsPage;
