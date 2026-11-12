"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { INVENTORY_QUERY_KEY, WAREHOUSES_QUERY_KEY, useWarehousesQuery } from "@/backend-api/inventory/hooks";
import { deleteWarehouse, setMainWarehouse, updateWarehouse } from "@/backend-api/inventory/mutations";
import { Warehouse } from "@/backend-api/inventory/types";
import SimpleTable from "@/components/Table/SimpleTable";
import WarehouseDialog from "@/features/Inventory/WarehouseDialog";
import { warehouseName } from "@/features/Inventory/warehouseName";
import { toastError } from "@/features/Purchasing/shared";

type Pending = { kind: "main" | "close" | "open" | "delete"; warehouse: Warehouse };

/**
 * Where stock is kept. Sales take stock from the main warehouse only; the
 * others hold stock that is transferred to it. How many may be open is set
 * by the store's plan.
 */
const WarehousesPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { data, isLoading } = useWarehousesQuery();
  const [editing, setEditing] = useState<{ key: number; warehouse?: Warehouse } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("inventory"), link: `/${lang}/admin/inventory` }, { title: t("warehouses") }],
        breadCrumbBtns: [{ title: t("stockTransfers"), icon: "add", link: `/${lang}/admin/inventory/transfers` }],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const warehouses = data?.data ?? [];
  const open = warehouses.filter((w) => w.isActive).length;
  const max = data?.max ?? 1;
  const full = open >= max;

  const action = useMutation({
    mutationFn: async ({ kind, warehouse }: Pending) => {
      if (kind === "main") return setMainWarehouse(warehouse._id);
      if (kind === "delete") return deleteWarehouse(warehouse._id);
      return updateWarehouse({ id: warehouse._id, isActive: kind === "open" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      setPending(null);
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: t("name"),
        render: (row: Warehouse) => (
          <Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight={600}>
                {warehouseName(row, lang)}
              </Typography>
              {row.isMain && <Chip size="small" color="primary" label={t("mainWarehouse")} />}
            </Stack>
            {row.address && (
              <Typography variant="caption" color="text.secondary">
                {row.address}
              </Typography>
            )}
          </Stack>
        ),
      },
      { id: "code", header: t("warehouseCode"), render: (row: Warehouse) => <span dir="ltr">{row.code}</span> },
      {
        id: "units",
        header: t("totalUnits"),
        render: (row: Warehouse) => (
          <Typography variant="body2" fontWeight={700} color={row.units < 0 ? "error.main" : "text.primary"}>
            {row.units}
          </Typography>
        ),
      },
      { id: "items", header: t("items"), render: (row: Warehouse) => row.items },
      {
        id: "status",
        header: t("status"),
        render: (row: Warehouse) =>
          row.isActive ? <Chip size="small" color="success" label={t("active")} /> : <Chip size="small" label={t("closed")} />,
      },
      {
        id: "actions",
        header: "",
        render: (row: Warehouse) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setEditing({ key: Date.now(), warehouse: row })}>
              {t("edit")}
            </Button>
            {!row.isMain && row.isActive && (
              <Button size="small" onClick={() => setPending({ kind: "main", warehouse: row })}>
                {t("makeMain")}
              </Button>
            )}
            {!row.isMain &&
              (row.isActive ? (
                <Button size="small" color="warning" onClick={() => setPending({ kind: "close", warehouse: row })}>
                  {t("closeWarehouse")}
                </Button>
              ) : (
                <Button size="small" disabled={full} onClick={() => setPending({ kind: "open", warehouse: row })}>
                  {t("openWarehouse")}
                </Button>
              ))}
            {!row.isMain && (
              <Button size="small" color="error" onClick={() => setPending({ kind: "delete", warehouse: row })}>
                {t("delete")}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [t, lang, full],
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="contained" disabled={full} onClick={() => setEditing({ key: Date.now() })}>
          {t("newWarehouse")}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {t("warehousesUsed", { open, max })}
        </Typography>
      </Stack>
      {full && max > 1 && <Alert severity="info">{t("warehouseLimitReached")}</Alert>}
      {max === 1 && <Alert severity="info">{t("warehouseLimitOne")}</Alert>}

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={warehouses.map((w) => ({ ...w, id: w._id }))} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      {editing && <WarehouseDialog key={editing.key} warehouse={editing.warehouse} onClose={() => setEditing(null)} />}

      <Dialog open={!!pending} onClose={() => setPending(null)} fullWidth maxWidth="xs">
        <DialogTitle>{pending && warehouseName(pending.warehouse, lang)}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{pending && t(`warehouseConfirm_${pending.kind}`)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>{t("back")}</Button>
          <Button
            variant="contained"
            color={pending?.kind === "delete" ? "error" : "primary"}
            disabled={action.isPending}
            onClick={() => pending && action.mutate(pending)}
          >
            {t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default WarehousesPage;
