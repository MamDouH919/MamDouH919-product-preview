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
  MenuItem,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from "@mui/material";
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
import SimpleTable from "@/components/Table/SimpleTable";

const StockMovementsPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const lang = i18n.language;

  const [filters, setFilters] = useState<MovementFilters>({ page: 1, limit: 25 });

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
      })
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
          new Date(row.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB"),
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
    [t, lang]
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label={t("product")}
          value={filters.productId ?? ""}
          onChange={(e) => setFilter({ productId: e.target.value || undefined })}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {(products ?? []).map((product) => (
            <MenuItem key={product._id} value={product._id}>
              {product.name[lang] ?? product.name.en ?? ""}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label={t("movementType")}
          value={filters.type ?? ""}
          onChange={(e) =>
            setFilter({ type: (e.target.value || undefined) as MovementType | undefined })
          }
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {(movementTypes ?? []).map(({ type }) => (
            <MenuItem key={type} value={type}>
              {t(`movement_${type}`)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          type="date"
          label={t("from")}
          InputLabelProps={{ shrink: true }}
          value={filters.from ?? ""}
          onChange={(e) => setFilter({ from: e.target.value || undefined })}
        />
        <TextField
          size="small"
          type="date"
          label={t("to")}
          InputLabelProps={{ shrink: true }}
          value={filters.to ?? ""}
          onChange={(e) => setFilter({ to: e.target.value || undefined })}
        />
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

export default StockMovementsPage;
