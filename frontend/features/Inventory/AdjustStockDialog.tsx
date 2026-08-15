"use client";

import { useEffect, useState } from "react";
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
  Divider,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { adjustStock, stockTake } from "@/backend-api/inventory/mutations";
import {
  INVENTORY_QUERY_KEY,
  MOVEMENTS_QUERY_KEY,
  useMovementTypesQuery,
} from "@/backend-api/inventory/hooks";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { MovementType, StockLevel } from "@/backend-api/inventory/types";

type Mode = "movement" | "count";

interface AdjustStockDialogProps {
  row: StockLevel | null;
  onClose: () => void;
}

/**
 * Two ways to change stock: record what happened (a delivery arrived, something
 * broke), or report what is physically on the shelf and let the server work out
 * the difference. The second is what an admin actually does during a stock take,
 * and it avoids asking them to do mental arithmetic.
 *
 * Quantities entered here are always positive counts. Which types may be picked
 * and which way each one moves stock are the server's rules — this dialog only
 * renders them.
 */
const AdjustStockDialog = ({ row, onClose }: AdjustStockDialogProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: movementTypes } = useMovementTypesQuery();
  const manualTypes = (movementTypes ?? []).filter((info) => info.manual);

  const [mode, setMode] = useState<Mode>("movement");
  const [type, setType] = useState<MovementType | "">("");
  const [quantity, setQuantity] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (!row) return;
    setMode("movement");
    setType("");
    setQuantity("");
    setCounted(String(row.stock));
    setReason("");
    setReference("");
  }, [row]);

  // Until the admin picks one, the first type the server offers is the default.
  const selectedType = type || manualTypes[0]?.type || "";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [MOVEMENTS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row) return null;

      if (mode === "count") {
        return stockTake({
          productId: row.productId,
          variantId: row.variantId,
          countedQuantity: Number(counted),
          reason: reason || undefined,
        });
      }

      if (!selectedType) return null;

      return adjustStock({
        productId: row.productId,
        variantId: row.variantId,
        type: selectedType,
        quantity: Number(quantity),
        reason: reason || undefined,
        reference: reference || undefined,
      });
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(
        mode === "count" && result === null
          ? t("stockAlreadyMatches")
          : t("saveSuccessfully")
      );
      onClose();
    },
    onError: (error: any) => {
      // The server rejects overselling with a specific message — showing it is
      // far more useful than a generic failure toast.
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong"));
    },
  });

  if (!row) return null;

  const title = row.name[lang] ?? row.name.en ?? row.name.ar ?? "";
  const parsedQuantity = Number(quantity);
  const parsedCounted = Number(counted);

  const delta =
    mode === "count" && counted !== "" ? parsedCounted - row.stock : null;

  const canSubmit =
    mode === "count"
      ? counted !== "" && Number.isInteger(parsedCounted) && parsedCounted >= 0
      : !!selectedType &&
        quantity !== "" &&
        Number.isInteger(parsedQuantity) &&
        parsedQuantity > 0;

  return (
    <Dialog open={!!row} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        <Stack>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
            {row.variantLabel ? ` — ${row.variantLabel}` : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("currentStock")}: {row.stock}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            fullWidth
            size="small"
            onChange={(_, value: Mode | null) => value && setMode(value)}
          >
            <ToggleButton value="movement">{t("recordMovement")}</ToggleButton>
            <ToggleButton value="count">{t("stockTake")}</ToggleButton>
          </ToggleButtonGroup>

          {mode === "movement" ? (
            <>
              <TextField
                select
                fullWidth
                size="small"
                label={t("movementType")}
                value={selectedType}
                onChange={(e) => setType(e.target.value as MovementType)}
              >
                {manualTypes.map((option) => (
                  <MenuItem key={option.type} value={option.type}>
                    {t(`movement_${option.type}`)}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("quantity")}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                helperText={t("positiveQuantityHint")}
              />

              <TextField
                fullWidth
                size="small"
                label={t("reference")}
                placeholder={t("referencePlaceholder")}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("countedQuantity")}
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />

              {delta !== null && (
                <Alert severity={delta === 0 ? "info" : delta > 0 ? "success" : "warning"}>
                  {delta === 0
                    ? t("stockAlreadyMatches")
                    : `${t("difference")}: ${delta > 0 ? "+" : ""}${delta}`}
                </Alert>
              )}
            </>
          )}

          <Divider />

          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label={t("reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t("cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdjustStockDialog;
