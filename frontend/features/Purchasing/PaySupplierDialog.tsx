"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { paySupplier } from "@/backend-api/purchasing/mutations";
import { PURCHASES_QUERY_KEY, SUPPLIERS_QUERY_KEY } from "@/backend-api/purchasing/hooks";
import { Supplier } from "@/backend-api/purchasing/types";
import { formatMinorMoney, minorToInput } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";
import { AMOUNT, inputToMinor, toastError, todayInput } from "./shared";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";

/** Pays a supplier from the store's cash. It settles their oldest unpaid purchases first; never more than is owed. */
const PaySupplierDialog = ({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const [amount, setAmount] = useState<string | null>(null);
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");

  const value = amount ?? (supplier ? minorToInput(supplier.owedMinor) : "");
  const valid = !!supplier && AMOUNT.test(value) && inputToMinor(value) > 0 && inputToMinor(value) <= supplier.owedMinor;

  const mutation = useMutation({
    mutationFn: () =>
      paySupplier({ supplierId: supplier!._id, amount: value, date: new Date(date).toISOString(), moneyAccountId: moneyAccountId || undefined, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PURCHASES_QUERY_KEY] });
      toast.success(t("supplierPaid"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  return (
    <Dialog open={!!supplier} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{supplier && t("paySupplierTitle", { name: supplier.name })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          {supplier && <Alert severity="info">{t("owedToSupplier", { amount: formatMinorMoney(supplier.owedMinor, currency) })}</Alert>}
          <TextField
            label={t("amount")}
            value={value}
            onChange={(e) => setAmount(e.target.value.trim())}
            error={!!value && !valid}
            slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
          />
          <TextField label={t("date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayInput() } }} />
          <MoneyAccountSelect value={moneyAccountId} onChange={setMoneyAccountId} label={t("paidFrom")} />
          <TextField label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("pay")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaySupplierDialog;
