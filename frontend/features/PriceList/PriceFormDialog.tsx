"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { DELIVERY_AREAS_QUERY_KEY, PRICE_LIST_QUERY_KEY } from "@/backend-api/price-list/hooks";
import { createDeliveryPrice, setZonePrice, updateDeliveryPrice } from "@/backend-api/price-list/mutations";
import { DeliveryPrice, Zone } from "@/backend-api/price-list/types";
import { useCurrency } from "@/Hooks/useCurrency";
import { localized } from "@/features/Order/format";

/**
 * Adds or edits one row of the price list, or (`mode="zone"`) prices every
 * area of a zone at once. Mounted fresh each time it opens, so state is the reset.
 */
const PriceFormDialog = ({
  mode,
  row,
  zones,
  pricedSubZones,
  onClose,
}: {
  mode: "single" | "zone";
  /** The row being edited, or null to add one. Ignored in zone mode. */
  row: DeliveryPrice | null;
  zones: Zone[];
  /** Subzones that already have a row, which can't be added twice. */
  pricedSubZones: Set<string>;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const currency = useCurrency();

  const [zoneId, setZoneId] = useState(row?.zone._id ?? "");
  const [subZoneId, setSubZoneId] = useState(row?.subZone._id ?? "");
  const [price, setPrice] = useState(row ? String(row.price) : "");
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [submitted, setSubmitted] = useState(false);

  const zone = zones.find((z) => z._id === zoneId);

  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(price);
      if (mode === "zone") return setZonePrice({ zoneId, price: amount });
      if (row) return updateDeliveryPrice({ id: row._id, data: { price: amount, isActive } });
      return createDeliveryPrice({ subZoneId, price: amount, isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRICE_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_AREAS_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
    },
  });

  const errors = {
    zone: !zoneId ? t("required") : "",
    subZone: mode === "single" && !subZoneId ? t("required") : "",
    price: price.trim() === "" || !(Number(price) >= 0) ? t("required") : "",
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    mutation.mutate();
  };

  const title = mode === "zone" ? t("setZonePrice") : row ? t("editDeliveryPrice") : t("addDeliveryPrice");

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: mode === "zone" ? 12 : 6 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t("zone")}
                value={zoneId}
                disabled={!!row}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  setSubZoneId("");
                }}
                error={!!show("zone")}
                helperText={show("zone")}
              >
                {zones.map((z) => (
                  <MenuItem key={z._id} value={z._id}>
                    {localized(z.name, lang)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {mode === "single" && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t("subZone")}
                  value={subZoneId}
                  disabled={!!row || !zone}
                  onChange={(e) => setSubZoneId(e.target.value)}
                  error={!!show("subZone")}
                  helperText={show("subZone")}
                >
                  {(zone?.subZones ?? []).map((s) => (
                    <MenuItem
                      key={s._id}
                      value={s._id}
                      disabled={!row && pricedSubZones.has(s._id)}
                    >
                      {localized(s.name, lang)}
                      {!row && pricedSubZones.has(s._id) ? ` (${t("alreadyPriced")})` : ""}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("deliveryPrice")}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                error={!!show("price")}
                helperText={show("price") || t("deliveryPriceHint")}
                slotProps={{
                  htmlInput: { min: 0, step: "any" },
                  input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
                }}
              />
            </Grid>

            {mode === "single" && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
                  label={t("active")}
                />
              </Grid>
            )}

            {mode === "zone" && zone && (
              <Grid size={12}>
                <Alert severity="info">
                  {t("setZonePriceHint", { count: zone.subZones.length, zone: localized(zone.name, lang) })}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {t("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PriceFormDialog;
