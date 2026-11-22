"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  useTransfersQuery,
  useWarehousesQuery,
} from "@/backend-api/inventory/hooks";
import { StockTransfer } from "@/backend-api/inventory/types";
import PageActions, { PagePrimaryButton } from "@/components/PageActions";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import SimpleTable from "@/components/Table/SimpleTable";
import TransferDialog from "@/features/Inventory/TransferDialog";
import { warehouseName } from "@/features/Inventory/warehouseName";

const LIMIT = 25;

/** Every transfer between warehouses, newest first. */
const TransfersPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const [warehouseId, setWarehouseId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState<number | null>(null);
  const { data: warehouses } = useWarehousesQuery();
  const { data, isLoading } = useTransfersQuery({
    warehouseId: warehouseId || undefined,
    page,
    limit: LIMIT,
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("inventory"), link: `/${lang}/admin/inventory` },
          { title: t("stockTransfers") },
        ],
        breadCrumbBtns: [
          {
            title: t("warehouses"),
            icon: "add",
            link: `/${lang}/admin/inventory/warehouses`,
          },
        ],
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
        header: "#",
        render: (row: StockTransfer) => row.transferNumber,
      },
      {
        id: "date",
        header: t("date"),
        render: (row: StockTransfer) =>
          new Date(row.createdAt).toLocaleString(
            lang === "ar" ? "ar-EG" : "en-GB",
          ),
      },
      {
        id: "route",
        header: t("route"),
        render: (row: StockTransfer) => (
          <Typography variant="body2">
            {warehouseName(row.from, lang)} {lang === "ar" ? "←" : "→"}{" "}
            {warehouseName(row.to, lang)}
          </Typography>
        ),
      },
      {
        id: "lines",
        header: t("items"),
        render: (row: StockTransfer) => (
          <Stack>
            {row.lines.map((line, i) => (
              <Typography key={i} variant="caption">
                {line.quantity} ×{" "}
                {line.name[lang] ?? line.name.en ?? line.name.ar}
                {line.variantLabel ? ` — ${line.variantLabel}` : ""}
              </Typography>
            ))}
          </Stack>
        ),
      },
      {
        id: "units",
        header: t("totalUnits"),
        render: (row: StockTransfer) => row.totalUnits,
      },
      {
        id: "note",
        header: t("notes"),
        render: (row: StockTransfer) => row.note ?? "—",
      },
      {
        id: "by",
        header: t("by"),
        render: (row: StockTransfer) => row.createdBy?.name ?? "—",
      },
    ],
    [t, lang],
  );

  return (
    <Stack spacing={2} height="100%">
      <PageActions>
        <PagePrimaryButton
          disabled={
            (warehouses?.data.filter((w) => w.isActive).length ?? 0) < 2
          }
          onClick={() => setCreating(Date.now())}
        >
          {t("newTransfer")}
        </PagePrimaryButton>
      </PageActions>
      <FilterLayout
        activeCount={warehouseId ? 1 : 0}
        chips={
          warehouseId
            ? [
                {
                  key: "wh",
                  label: (() => {
                    const w = warehouses?.data.find(
                      (x) => x._id === warehouseId,
                    );
                    return w ? warehouseName(w, lang) : t("warehouse");
                  })(),
                  onDelete: () => {
                    setWarehouseId("");
                    setPage(1);
                  },
                },
              ]
            : []
        }
        onClear={() => {
          setWarehouseId("");
          setPage(1);
        }}
        filters={
          <FilterSelect
            label={t("warehouse")}
            value={warehouseId || undefined}
            onChange={(id) => {
              setWarehouseId(id ?? "");
              setPage(1);
            }}
            options={(warehouses?.data ?? []).map((w) => ({
              value: w._id,
              label: warehouseName(w, lang),
            }))}
          />
        }
      >
        <SimpleTable
          columns={columns}
          data={(data?.data ?? []).map((row) => ({ ...row, id: row._id }))}
          height="100%"
          loading={isLoading}
          pagination={{
            count: data?.total ?? 0,
            page: page - 1,
            rowsPerPage: LIMIT,
            onPageChange: (p) => setPage(p + 1),
            onRowsPerPageChange: () => {},
            rowsPerPageOptions: [LIMIT],
          }}
        />
      </FilterLayout>
      {creating && (
        <TransferDialog key={creating} onClose={() => setCreating(null)} />
      )}
    </Stack>
  );
};

export default TransfersPage;
