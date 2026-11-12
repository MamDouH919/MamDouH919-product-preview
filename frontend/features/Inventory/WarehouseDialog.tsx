"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { createWarehouse, updateWarehouse } from "@/backend-api/inventory/mutations";
import { WAREHOUSES_QUERY_KEY } from "@/backend-api/inventory/hooks";
import { Warehouse } from "@/backend-api/inventory/types";
import { toastError } from "@/features/Purchasing/shared";

/** Adds a warehouse, or edits one when `warehouse` is given. Mount with a fresh `key` per opening. */
const WarehouseDialog = ({ warehouse, onClose }: { warehouse?: Warehouse; onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nameAr: warehouse?.name.ar ?? "",
    nameEn: warehouse?.name.en ?? "",
    code: warehouse?.code ?? "",
    address: warehouse?.address ?? "",
    notes: warehouse?.notes ?? "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: { ar: form.nameAr.trim() || undefined, en: form.nameEn.trim() || undefined },
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      return warehouse ? updateWarehouse({ id: warehouse._id, ...body }) : createWarehouse(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const codeValid = /^[A-Za-z0-9-]{1,12}$/.test(form.code.trim());
  const canSave = (form.nameAr.trim() || form.nameEn.trim()) && codeValid && !mutation.isPending;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(warehouse ? "editWarehouse" : "newWarehouse")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField label={t("nameAr")} value={form.nameAr} onChange={set("nameAr")} autoFocus />
          <TextField label={t("nameEn")} value={form.nameEn} onChange={set("nameEn")} slotProps={{ htmlInput: { dir: "ltr" } }} />
          <TextField
            label={t("warehouseCode")}
            value={form.code}
            onChange={set("code")}
            required
            error={!!form.code && !codeValid}
            helperText={t("warehouseCodeHint")}
            slotProps={{ htmlInput: { dir: "ltr", maxLength: 12, style: { textTransform: "uppercase" } } }}
          />
          <TextField label={t("address")} value={form.address} onChange={set("address")} />
          <TextField label={t("notes")} value={form.notes} onChange={set("notes")} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => mutation.mutate()}>
          {t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WarehouseDialog;
