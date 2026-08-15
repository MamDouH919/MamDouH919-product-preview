"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  Box,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import HistoryIcon from "@mui/icons-material/History";
import Image from "next/image";
import {
  useInventorySummaryQuery,
  useStockLevelsQuery,
} from "@/backend-api/inventory/hooks";
import { InventoryFilters, StockLevel } from "@/backend-api/inventory/types";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { getBackendUri } from "@/utils/helperFunctions";
import SimpleTable from "@/components/Table/SimpleTable";
import AdjustStockDialog from "@/features/Inventory/AdjustStockDialog";
import ProductMovementsDialog from "@/features/Inventory/ProductMovementsDialog";
import StockStatusChip from "@/features/Inventory/StockStatusChip";

const SummaryTile = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 150 }}>
    <Typography variant="body2" color="text.secondary" noWrap>
      {label}
    </Typography>
    <Typography variant="h5" fontWeight={700} color={color}>
      {value}
    </Typography>
  </Paper>
);

const InventoryPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const lang = i18n.language;

  const [filters, setFilters] = useState<InventoryFilters>({ status: "all" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StockLevel | null>(null);
  const [historyRow, setHistoryRow] = useState<StockLevel | null>(null);

  // Keeps the table from refetching on every keystroke.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((prev) => ({ ...prev, search: search || undefined })),
      350
    );
    return () => clearTimeout(timer);
  }, [search]);

  const { data: levels, isLoading } = useStockLevelsQuery(filters);
  const { data: summary } = useInventorySummaryQuery();
  const { data: categories } = useCategoriesQuery();

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("inventory") }],
        breadCrumbBtns: [
          {
            title: t("stockMovements"),
            icon: "add",
            link: `/${i18n.language}/admin/inventory/movements`,
          },
        ],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(
    () => (levels ?? []).map((row) => ({ ...row, id: `${row.productId}-${row.variantId ?? ""}` })),
    [levels]
  );

  const columns = useMemo(
    () => [
      {
        id: "image",
        header: t("image"),
        render: (row: StockLevel) => (
          <Stack p={0.5}>
            <Image
              src={getBackendUri(row.image)}
              alt={row.name[lang] ?? ""}
              width={48}
              height={48}
              style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }}
              loading="eager"
            />
          </Stack>
        ),
      },
      {
        id: "name",
        header: t("product"),
        render: (row: StockLevel) => (
          <Stack>
            <Typography variant="body2">
              {row.name[lang] ?? row.name.en ?? row.name.ar ?? ""}
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
        id: "sku",
        header: t("sku"),
        render: (row: StockLevel) => row.sku ?? "—",
      },
      {
        id: "stock",
        header: t("stock"),
        render: (row: StockLevel) => (
          <Typography
            variant="body2"
            fontWeight={700}
            color={row.stock <= 0 ? "error.main" : "text.primary"}
          >
            {row.trackStock ? row.stock : "∞"}
          </Typography>
        ),
      },
      {
        id: "lowStockThreshold",
        header: t("lowStockThreshold"),
        render: (row: StockLevel) =>
          row.lowStockThreshold > 0 ? (
            <Chip label={row.lowStockThreshold} size="small" variant="outlined" />
          ) : (
            "—"
          ),
      },
      {
        id: "status",
        header: t("status"),
        render: (row: StockLevel) => <StockStatusChip status={row.status} />,
      },
      {
        id: "actions",
        header: t("actions"),
        render: (row: StockLevel) => (
          <Stack direction="row">
            <Tooltip title={t("transactions")}>
              <IconButton onClick={() => setHistoryRow(row)}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={row.trackStock ? t("adjustStock") : t("stockNotTracked")}>
              <span>
                <IconButton onClick={() => setSelected(row)} disabled={!row.trackStock}>
                  <TuneIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [t, lang]
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <SummaryTile label={t("trackedItems")} value={summary?.trackedItems ?? 0} />
        <SummaryTile label={t("totalUnits")} value={summary?.totalUnits ?? 0} />
        <SummaryTile
          label={t("stockValue")}
          value={(summary?.stockValue ?? 0).toLocaleString()}
        />
        <SummaryTile
          label={t("lowStock")}
          value={summary?.lowStockCount ?? 0}
          color={summary?.lowStockCount ? "warning.main" : undefined}
        />
        <SummaryTile
          label={t("outOfStock")}
          value={summary?.outOfStockCount ?? 0}
          color={summary?.outOfStockCount ? "error.main" : undefined}
        />
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label={t("status")}
          value={filters.status ?? "all"}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              status: e.target.value as InventoryFilters["status"],
            }))
          }
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">{t("all")}</MenuItem>
          <MenuItem value="in_stock">{t("stockStatus_in_stock")}</MenuItem>
          <MenuItem value="low">{t("stockStatus_low")}</MenuItem>
          <MenuItem value="out">{t("stockStatus_out")}</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label={t("category")}
          value={filters.categoryId ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, categoryId: e.target.value || undefined }))
          }
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {(categories ?? []).map((category) => (
            <MenuItem key={category._id} value={category._id}>
              {category.name[lang] ?? category.name.en ?? ""}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable
          columns={columns}
          data={rows}
          borderRadius={0}
          height="100%"
          loading={isLoading}
        />
      </Box>

      <AdjustStockDialog row={selected} onClose={() => setSelected(null)} />
      <ProductMovementsDialog row={historyRow} onClose={() => setHistoryRow(null)} />
    </Stack>
  );
};

export default InventoryPage;
