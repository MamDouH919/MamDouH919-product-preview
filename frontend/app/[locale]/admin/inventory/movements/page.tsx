"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { Stack, TextField, Typography } from "@mui/material";
import {
  useMovementTypesQuery,
  useStockMovementsQuery,
} from "@/backend-api/inventory/hooks";
import {
  MovementFilters,
  MovementType,
  StockMovement,
} from "@/backend-api/inventory/types";
import { useProductsQuery } from "@/backend-api/products/hooks";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import SimpleTable from "@/components/Table/SimpleTable";
import { warehouseName } from "@/features/Inventory/warehouseName";

const StockMovementsPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const lang = i18n.language;

  const [filters, setFilters] = useState<MovementFilters>({
    page: 1,
    limit: 25,
  });

  const { data, isLoading } = useStockMovementsQuery(filters);
  const { data: products } = useProductsQuery();
  const { data: movementTypes } = useMovementTypesQuery();

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("inventory"), link: `/admin/inventory` },
          { title: t("stockMovements") },
        ],
        breadCrumbBtns: [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilter = (patch: Partial<MovementFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns = useMemo(
    () => [
      {
        id: "createdAt",
        header: t("date"),
        render: (row: StockMovement) =>
          new Date(row.createdAt).toLocaleString(
            lang === "ar" ? "ar-EG" : lang === "es" ? "es-ES" : "en-GB",
          ),
      },
      {
        id: "product",
        header: t("product"),
        render: (row: StockMovement) => (
          <Stack>
            <Typography variant="body2">
              {row.product?.name?.[lang] ?? row.product?.name?.en ?? "—"}
            </Typography>
            {row.variantLabel && (
              <Typography variant="caption" color="text.secondary">
                {row.variantLabel}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        id: "type",
        header: t("movementType"),
        render: (row: StockMovement) => t(`movement_${row.type}`),
      },
      {
        id: "warehouse",
        header: t("warehouse"),
        render: (row: StockMovement) =>
          row.warehouse
            ? warehouseName(row.warehouse, lang)
            : t("mainWarehouse"),
      },
      {
        id: "quantity",
        header: t("change"),
        render: (row: StockMovement) => (
          <Typography
            variant="body2"
            fontWeight={700}
            color={row.quantity > 0 ? "success.main" : "error.main"}
          >
            {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
          </Typography>
        ),
      },
      {
        id: "balanceAfter",
        header: t("balanceAfter"),
        render: (row: StockMovement) => row.balanceAfter,
      },
      {
        id: "reason",
        header: t("reason"),
        render: (row: StockMovement) => row.reason ?? "—",
      },
      {
        id: "reference",
        header: t("reference"),
        render: (row: StockMovement) => row.reference ?? "—",
      },
      {
        id: "user",
        header: t("by"),
        render: (row: StockMovement) => row.user?.name ?? t("system"),
      },
    ],
    [t, lang],
  );

  const chips = [
    ...(filters.productId
      ? [
          {
            key: "product",
            label: (() => {
              const pr = products?.find((x) => x._id === filters.productId);
              return pr ? (pr.name[lang] ?? pr.name.en ?? "") : t("product");
            })(),
            onDelete: () => setFilter({ productId: undefined }),
          },
        ]
      : []),
    ...(filters.type
      ? [
          {
            key: "type",
            label: t(`movement_${filters.type}`),
            onDelete: () => setFilter({ type: undefined }),
          },
        ]
      : []),
    ...(filters.from || filters.to
      ? [
          {
            key: "date",
            label: `${filters.from ?? "…"} → ${filters.to ?? "…"}`,
            onDelete: () => setFilter({ from: undefined, to: undefined }),
          },
        ]
      : []),
  ];

  return (
    <Stack spacing={2} height="100%">
      <FilterLayout
        activeCount={chips.length}
        chips={chips}
        onClear={() => setFilters((prev) => ({ page: 1, limit: prev.limit }))}
        filters={
          <>
            <FilterSelect
              label={t("product")}
              value={filters.productId}
              onChange={(productId) => setFilter({ productId })}
              options={(products ?? []).map((p) => ({
                value: p._id,
                label: p.name[lang] ?? p.name.en ?? "",
              }))}
            />
            <FilterSelect
              label={t("movementType")}
              value={filters.type}
              onChange={(type) =>
                setFilter({ type: type as MovementType | undefined })
              }
              options={(movementTypes ?? []).map(({ type }) => ({
                value: type,
                label: t(`movement_${type}`),
              }))}
            />
            <Stack direction="row" gap={1}>
              <TextField
                size="small"
                type="date"
                label={t("from")}
                slotProps={{ inputLabel: { shrink: true } }}
                value={filters.from ?? ""}
                onChange={(e) =>
                  setFilter({ from: e.target.value || undefined })
                }
              />
              <TextField
                size="small"
                type="date"
                label={t("to")}
                slotProps={{ inputLabel: { shrink: true } }}
                value={filters.to ?? ""}
                onChange={(e) => setFilter({ to: e.target.value || undefined })}
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

export default StockMovementsPage;
