"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import StarOutline from "@mui/icons-material/StarOutline";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  INVENTORY_QUERY_KEY,
  WAREHOUSES_QUERY_KEY,
  useWarehousesQuery,
} from "@/backend-api/inventory/hooks";
import {
  deleteWarehouse,
  setMainWarehouse,
  updateWarehouse,
} from "@/backend-api/inventory/mutations";
import { Warehouse } from "@/backend-api/inventory/types";
import PageActions, { PagePrimaryButton } from "@/components/PageActions";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import SimpleTable from "@/components/Table/SimpleTable";
import WarehouseDialog from "@/features/Inventory/WarehouseDialog";
import { warehouseName } from "@/features/Inventory/warehouseName";
import { toastError } from "@/features/Purchasing/shared";

type Pending = {
  kind: "main" | "close" | "open" | "delete";
  warehouse: Warehouse;
};

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
  const [editing, setEditing] = useState<{
    key: number;
    warehouse?: Warehouse;
  } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("inventory"), link: `/${lang}/admin/inventory` },
          { title: t("warehouses") },
        ],
        breadCrumbBtns: [
          {
            title: t("stockTransfers"),
            icon: "add",
            link: `/${lang}/admin/inventory/transfers`,
          },
        ],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const warehouses = useMemo(() => data?.data ?? [], [data]);
  const open = warehouses.filter((w) => w.isActive).length;
  const max = data?.max ?? 1;
  const full = open >= max;

  const [search, setSearch] = useState("");
  const [state, setState] = useState<"active" | "closed">();
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return warehouses
      .filter(
        (w) =>
          (!state || (state === "active") === w.isActive) &&
          (!term ||
            [warehouseName(w, lang), w.code, w.address].some((v) =>
              v?.toLowerCase().includes(term),
            )),
      )
      .map((w) => ({ ...w, id: w._id }));
  }, [warehouses, search, state, lang]);
  const chips = [
    ...(state
      ? [
          {
            key: "state",
            label: t(state === "active" ? "active" : "closed"),
            onDelete: () => setState(undefined),
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
              {row.isMain && (
                <Chip size="small" color="primary" label={t("mainWarehouse")} />
              )}
            </Stack>
            {row.address && (
              <Typography variant="caption" color="text.secondary">
                {row.address}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        id: "code",
        header: t("warehouseCode"),
        render: (row: Warehouse) => <span dir="ltr">{row.code}</span>,
      },
      {
        id: "units",
        header: t("totalUnits"),
        render: (row: Warehouse) => (
          <Typography
            variant="body2"
            fontWeight={700}
            color={row.units < 0 ? "error.main" : "text.primary"}
          >
            {row.units}
          </Typography>
        ),
      },
      {
        id: "items",
        header: t("items"),
        render: (row: Warehouse) => row.items,
      },
      {
        id: "status",
        header: t("status"),
        render: (row: Warehouse) =>
          row.isActive ? (
            <Chip size="small" color="success" label={t("active")} />
          ) : (
            <Chip size="small" label={t("closed")} />
          ),
      },
      {
        id: "actions",
        header: "",
        render: (row: Warehouse) => (
          <Stack direction="row" gap={0.25}>
            <Tooltip title={t("edit")}>
              <IconButton
                size="small"
                onClick={() => setEditing({ key: Date.now(), warehouse: row })}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            {!row.isMain && row.isActive && (
              <Tooltip title={t("makeMain")}>
                <IconButton
                  size="small"
                  onClick={() => setPending({ kind: "main", warehouse: row })}
                >
                  <StarOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {!row.isMain &&
              (row.isActive ? (
                <Tooltip title={t("closeWarehouse")}>
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={() =>
                      setPending({ kind: "close", warehouse: row })
                    }
                  >
                    <LockOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title={t("openWarehouse")}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={full}
                      onClick={() =>
                        setPending({ kind: "open", warehouse: row })
                      }
                    >
                      <LockOpenOutlined fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ))}
            {!row.isMain && (
              <Tooltip title={t("delete")}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setPending({ kind: "delete", warehouse: row })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [t, lang, full],
  );

  return (
    <Stack spacing={2} height="100%">
      <PageActions>
        <PagePrimaryButton
          disabled={full}
          onClick={() => setEditing({ key: Date.now() })}
        >
          {t("newWarehouse")}
        </PagePrimaryButton>
      </PageActions>
      {full && max > 1 && (
        <Alert severity="info">{t("warehouseLimitReached")}</Alert>
      )}
      {max === 1 && <Alert severity="info">{t("warehouseLimitOne")}</Alert>}

      <FilterLayout
        search={{ value: search, onChange: setSearch }}
        activeCount={chips.length}
        chips={chips}
        onClear={() => {
          setSearch("");
          setState(undefined);
        }}
        filters={
          <FilterSelect
            label={t("status")}
            value={state}
            onChange={setState}
            options={[
              { value: "active", label: t("active") },
              { value: "closed", label: t("closed") },
            ]}
          />
        }
        actions={
          <Typography variant="body2" color="text.secondary">
            {t("warehousesUsed", { open, max })}
          </Typography>
        }
      >
        <SimpleTable
          clientPagination
          columns={columns}
          data={rows}
          height="100%"
          loading={isLoading}
        />
      </FilterLayout>

      {editing && (
        <WarehouseDialog
          key={editing.key}
          warehouse={editing.warehouse}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {pending && warehouseName(pending.warehouse, lang)}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {pending && t(`warehouseConfirm_${pending.kind}`)}
          </Typography>
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
