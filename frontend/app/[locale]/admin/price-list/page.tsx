"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import {
  DELIVERY_AREAS_QUERY_KEY,
  PRICE_LIST_QUERY_KEY,
  useDeliveryPricesQuery,
  useZonesQuery,
} from "@/backend-api/price-list/hooks";
import { deleteDeliveryPrice, updateDeliveryPrice } from "@/backend-api/price-list/mutations";
import { DeliveryPrice } from "@/backend-api/price-list/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import FlatPriceCard from "@/features/PriceList/FlatPriceCard";
import PriceFormDialog from "@/features/PriceList/PriceFormDialog";
import { formatMoney, localized } from "@/features/Order/format";

const PriceListPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();

  const [zoneFilter, setZoneFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [form, setForm] = useState<{ mode: "single" | "zone"; row: DeliveryPrice | null } | null>(null);
  const [deleting, setDeleting] = useState<DeliveryPrice | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: zones, isLoading: zonesLoading } = useZonesQuery();
  const { data, isLoading } = useDeliveryPricesQuery({ zone: zoneFilter, search: debounced });
  // Every priced subzone, not just the filtered ones, so the add dialog can't duplicate a row.
  const { data: all } = useDeliveryPricesQuery();
  const pricedSubZones = useMemo(() => new Set((all ?? []).map((r) => r.subZone._id)), [all]);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("priceList") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [PRICE_LIST_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [DELIVERY_AREAS_QUERY_KEY] });
  };
  const onError = (error: any) => toast.error(error?.response?.data?.message ?? t("somethingWentWrong"));

  const toggleMutation = useMutation({
    mutationFn: (row: DeliveryPrice) => updateDeliveryPrice({ id: row._id, data: { isActive: !row.isActive } }),
    onSuccess: refresh,
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryPrice,
    onSuccess: () => {
      refresh();
      setDeleting(null);
      toast.success(t("deletedSuccessfully"));
    },
    onError,
  });

  const columns = useMemo(
    () => [
      {
        id: "zone",
        header: t("zone"),
        render: (row: DeliveryPrice) => localized(row.zone.name, lang),
      },
      {
        id: "subZone",
        header: t("subZone"),
        render: (row: DeliveryPrice) => (
          <Typography variant="body2" fontWeight={600}>
            {localized(row.subZone.name, lang)}
          </Typography>
        ),
      },
      {
        id: "price",
        header: t("deliveryPrice"),
        render: (row: DeliveryPrice) => (row.price > 0 ? formatMoney(row.price, currency) : t("free")),
      },
      {
        id: "active",
        header: t("active"),
        render: (row: DeliveryPrice) => (
          <Switch
            size="small"
            checked={row.isActive}
            disabled={toggleMutation.isPending}
            onChange={() => toggleMutation.mutate(row)}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: DeliveryPrice) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t("edit")}>
              <IconButton size="small" onClick={() => setForm({ mode: "single", row })}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("delete")}>
              <IconButton size="small" color="error" onClick={() => setDeleting(row)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [t, lang, currency, toggleMutation]
  );

  // No zones means no country has been picked (and seeded) yet.
  if (!zonesLoading && !zones?.length) {
    return <Alert severity="info">{t("priceListNeedsCountry")}</Alert>;
  }

  return (
    <Stack spacing={2} height="100%">
      <FlatPriceCard />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            size="small"
            label={t("zone")}
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">{t("all")}</MenuItem>
            {(zones ?? []).map((z) => (
              <MenuItem key={z._id} value={z._id}>
                {localized(z.name, lang)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setForm({ mode: "zone", row: null })}>
            {t("setZonePrice")}
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ mode: "single", row: null })}>
            {t("addDeliveryPrice")}
          </Button>
        </Stack>
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      {form && (
        <PriceFormDialog
          mode={form.mode}
          row={form.row}
          zones={zones ?? []}
          pricedSubZones={pricedSubZones}
          onClose={() => setForm(null)}
        />
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t("deleteDeliveryPriceConfirm", { area: deleting ? localized(deleting.subZone.name, lang) : "" })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t("deleteDeliveryPriceHint")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting._id)}
          >
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default PriceListPage;
