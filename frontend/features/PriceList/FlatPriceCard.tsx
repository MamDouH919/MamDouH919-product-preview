"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, FormControlLabel, InputAdornment, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import { DELIVERY_AREAS_QUERY_KEY, FLAT_PRICE_QUERY_KEY, useFlatPriceQuery } from "@/backend-api/price-list/hooks";
import { setFlatPrice } from "@/backend-api/price-list/mutations";
import { useCurrency } from "@/Hooks/useCurrency";
import { formatMoney } from "@/features/Order/format";

/**
 * One delivery price for the whole country. While it's on, checkout ignores the
 * per-area price list below and offers every area at this price.
 */
const FlatPriceCard = () => {
  const { data } = useFlatPriceQuery();
  if (!data) return null;
  // Remounts after each save, so the form starts again from what's stored.
  return <FlatPriceForm key={String(data.price)} saved={data.price} />;
};

const FlatPriceForm = ({ saved }: { saved: number | null }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();

  const [enabled, setEnabled] = useState(saved !== null);
  const [price, setPrice] = useState(saved !== null ? String(saved) : "");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: setFlatPrice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLAT_PRICE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_AREAS_QUERY_KEY] });
      setSubmitted(false);
      toast.success(t("saveSuccessfully"));
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
    },
  });

  const priceError = enabled && (price.trim() === "" || !(Number(price) >= 0)) ? t("required") : "";
  const dirty = enabled !== (saved !== null) || (enabled && Number(price) !== saved);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (priceError) return;
    mutation.mutate(enabled ? Number(price) : null);
  };

  return (
    <Paper variant="outlined" component="form" onSubmit={save} noValidate sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <FormControlLabel
            control={
              <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            }
            label={<Typography fontWeight={600}>{t("flatDeliveryPrice")}</Typography>}
          />
          {enabled && (
            <TextField
              size="small"
              type="number"
              label={t("deliveryPrice")}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={submitted && !!priceError}
              helperText={(submitted && priceError) || t("deliveryPriceHint")}
              sx={{ maxWidth: 220 }}
              slotProps={{
                htmlInput: { min: 0, step: "any" },
                input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
              }}
            />
          )}
          <Button type="submit" variant="contained" disabled={!dirty || mutation.isPending}>
            {t("save")}
          </Button>
        </Stack>
        {saved !== null ? (
          <Alert severity="warning">
            {t("flatDeliveryPriceActive", { price: saved > 0 ? formatMoney(saved, currency) : t("free") })}
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("flatDeliveryPriceHint")}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default FlatPriceCard;
