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
  Button,
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
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Image from "next/image";
import {
  useInventorySummaryQuery,
  useStockLevelsQuery,
  useWarehousesQuery,
} from "@/backend-api/inventory/hooks";
import TransferDialog from "@/features/Inventory/TransferDialog";
import { warehouseName } from "@/features/Inventory/warehouseName";
import { InventoryFilters, StockLevel } from "@/backend-api/inventory/types";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { getBackendUri } from "@/utils/helperFunctions";
import SimpleTable from "@/components/Table/SimpleTable";
import AdjustStockDialog from "@/features/Inventory/AdjustStockDialog";
import ProductMovementsDialog from "@/features/Inventory/ProductMovementsDialog";
import StockStatusChip from "@/features/Inventory/StockStatusChip";
import OpeningCostDialog from "@/features/Inventory/OpeningCostDialog";
import { formatMinorMoney } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";

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
  const [costRow, setCostRow] = useState<StockLevel | null>(null);
  const [correctRow, setCorrectRow] = useState<StockLevel | null>(null);
  const currency = useCurrency();

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
  const { data: warehousesData } = useWarehousesQuery();
  const warehouses = useMemo(() => warehousesData?.data ?? [], [warehousesData]);
  // One warehouse is how every store starts; columns per warehouse only once there are more.
  const multi = warehouses.length > 1;
  const [transferring, setTransferring] = useState<number | null>(null);

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
          {
            title: t("warehouses"),
            icon: "add",
            link: `/${i18n.language}/admin/inventory/warehouses`,
          },
          {
            title: t("stockTransfers"),
            icon: "add",
            link: `/${i18n.language}/admin/inventory/transfers`,
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
      ...(multi
        ? warehouses.map((w) => ({
            id: `wh-${w._id}`,
            header: w.isMain ? `${warehouseName(w, lang)} ★` : warehouseName(w, lang),
            render: (row: StockLevel) => {
              if (!row.trackStock) return "∞";
              const qty = row.stocks.find((e) => e.warehouseId === w._id)?.qty ?? 0;
              return (
                <Typography
                  variant="body2"
                  fontWeight={w.isMain ? 700 : 400}
                  color={qty < 0 || (w.isMain && qty === 0) ? "error.main" : qty === 0 ? "text.disabled" : "text.primary"}
                >
                  {qty}
                </Typography>
              );
            },
          }))
        : []),
      {
        id: "stock",
        header: multi ? t("totalStock") : t("stock"),
        render: (row: StockLevel) => (
          <Stack>
            <Typography
              variant="body2"
              fontWeight={700}
              color={(multi ? row.totalStock : row.stock) <= 0 ? "error.main" : "text.primary"}
            >
              {row.trackStock ? (multi ? row.totalStock : row.stock) : "∞"}
            </Typography>
            {row.trackStock && row.stock < 0 && (
              <Typography variant="caption" color="warning.main">
                {t("preorderOwed", { count: -row.stock })}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        id: "cost",
        header: t("unitCost"),
        render: (row: StockLevel) =>
          !row.trackStock ? (
            "—"
          ) : row.valued ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <span>{formatMinorMoney(row.unitCostMinor ?? 0, currency)}</span>
              {/* Nothing but the opening has touched it yet, so a mistyped cost can still be fixed. */}
              {row.costCorrectable && (
                <Tooltip title={t("correctOpeningCost")}>
                  <IconButton size="small" onClick={() => setCorrectRow(row)}>
                    <EditOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ) : (
            // Stock from before the books: no cost until someone says what it was.
            <Button size="small" color="warning" onClick={() => setCostRow(row)}>
              {t("setCost")}
            </Button>
          ),
      },
      {
        id: "price",
        header: t("sellingPrice"),
        render: (row: StockLevel) => (row.price != null ? row.price.toLocaleString() : "—"),
      },
      {
        id: "margin",
        header: t("profitMargin"),
        render: (row: StockLevel) => {
          if (!row.trackStock || !row.valued || row.unitCostMinor == null || !(row.price && row.price > 0)) return "—";
          const priceMinor = Math.round(row.price * 100);
          const profit = priceMinor - row.unitCostMinor;
          return (
            <Stack>
              <Typography variant="body2" fontWeight={700} color={profit < 0 ? "error.main" : "success.main"}>
                {((profit / priceMinor) * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatMinorMoney(profit, currency)}
              </Typography>
            </Stack>
          );
        },
      },
      {
        id: "value",
        header: t("valueAtCost"),
        render: (row: StockLevel) => (row.valued && row.valueMinor !== null ? formatMinorMoney(row.valueMinor, currency) : "—"),
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
    [t, lang, currency, multi, warehouses]
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <SummaryTile label={t("trackedItems")} value={summary?.trackedItems ?? 0} />
        <SummaryTile label={t("totalUnits")} value={summary?.totalUnits ?? 0} />
        <SummaryTile
          label={t("stockValueAtCost")}
          value={formatMinorMoney(summary?.costValueMinor ?? 0, currency)}
        />
        <SummaryTile
          label={t("stockValueAtPrice")}
          value={(summary?.stockValue ?? 0).toLocaleString()}
        />
        {!!summary?.uncostedItems && (
          <SummaryTile label={t("uncostedItems")} value={summary.uncostedItems} color="warning.main" />
        )}
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
        {multi && (
          <TextField
            select
            size="small"
            label={t("warehouse")}
            value={filters.warehouseId ?? ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, warehouseId: e.target.value || undefined }))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">{t("all")}</MenuItem>
            {warehouses.map((w) => (
              <MenuItem key={w._id} value={w._id}>
                {warehouseName(w, lang)}
              </MenuItem>
            ))}
          </TextField>
        )}
        {multi && (
          <Button variant="outlined" onClick={() => setTransferring(Date.now())}>
            {t("newTransfer")}
          </Button>
        )}
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
      <OpeningCostDialog row={costRow} onClose={() => setCostRow(null)} />
      <OpeningCostDialog row={correctRow} correct onClose={() => setCorrectRow(null)} />
      {transferring && <TransferDialog key={transferring} onClose={() => setTransferring(null)} />}
    </Stack>
  );
};

export default InventoryPage;
