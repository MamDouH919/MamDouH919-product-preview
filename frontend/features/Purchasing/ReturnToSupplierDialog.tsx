"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { returnToSupplier } from "@/backend-api/purchasing/mutations";
import { PURCHASES_QUERY_KEY, SUPPLIERS_QUERY_KEY } from "@/backend-api/purchasing/hooks";
import { PurchaseDetail } from "@/backend-api/purchasing/types";
import { toastError } from "./shared";

/** Sends goods back to the supplier: out of stock at what they were bought for, and off what is owed. */
const ReturnToSupplierDialog = ({ purchase, open, onClose }: { purchase: PurchaseDetail; open: boolean; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");

  const lines = purchase.lines
    .map((line, lineIndex) => ({ lineIndex, quantity: Number(quantities[lineIndex] || 0), left: line.quantity - line.returnedQty }))
    .filter((l) => l.quantity > 0);
  const valid = lines.length > 0 && lines.every((l) => Number.isInteger(l.quantity) && l.quantity <= l.left);

  const mutation = useMutation({
    mutationFn: () => returnToSupplier({ purchaseId: purchase._id, lines: lines.map(({ lineIndex, quantity }) => ({ lineIndex, quantity })), note: note.trim() || undefined }),
    onSuccess: () => {
      for (const key of [PURCHASES_QUERY_KEY, SUPPLIERS_QUERY_KEY, "inventory"]) queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(t("returnedToSupplier"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("returnToSupplier")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <Alert severity="info">{t("returnToSupplierHint")}</Alert>
          {purchase.lines.map((line, i) => {
            const left = line.quantity - line.returnedQty;
            return (
              <Stack key={i} direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" flex={1}>
                  {line.name[i18n.language] ?? line.name.en}
                  {line.variantLabel ? ` — ${line.variantLabel}` : ""}
                </Typography>
                <TextField
                  size="small"
                  label={t("unitsBack", { left })}
                  value={quantities[i] ?? ""}
                  disabled={left === 0}
                  onChange={(e) => setQuantities((q) => ({ ...q, [i]: e.target.value.trim() }))}
                  error={Number(quantities[i] || 0) > left}
                  sx={{ width: 160 }}
                  slotProps={{ htmlInput: { inputMode: "numeric", dir: "ltr" } }}
                />
              </Stack>
            );
          })}
          <TextField label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" color="warning" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("returnToSupplier")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReturnToSupplierDialog;
