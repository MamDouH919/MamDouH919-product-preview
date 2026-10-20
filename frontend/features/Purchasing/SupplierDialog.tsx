"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField } from "@mui/material";
import { createSupplier, updateSupplier } from "@/backend-api/purchasing/mutations";
import { SUPPLIERS_QUERY_KEY } from "@/backend-api/purchasing/hooks";
import { Supplier } from "@/backend-api/purchasing/types";
import { toastError } from "./shared";

/** Adds a supplier, or edits one when `supplier` is given. Mount with a fresh `key` per opening. */
const SupplierDialog = ({ open, supplier, onClose }: { open: boolean; supplier?: Supplier; onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    taxId: supplier?.taxId ?? "",
    notes: supplier?.notes ?? "",
    isActive: supplier?.isActive ?? true,
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      };
      return supplier ? updateSupplier({ id: supplier._id, ...body }) : createSupplier(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(supplier ? "editSupplier" : "newSupplier")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField label={t("name")} value={form.name} onChange={set("name")} required autoFocus />
          <TextField label={t("phone")} value={form.phone} onChange={set("phone")} slotProps={{ htmlInput: { dir: "ltr" } }} />
          <TextField label={t("email")} value={form.email} onChange={set("email")} slotProps={{ htmlInput: { dir: "ltr" } }} />
          <TextField label={t("taxId")} value={form.taxId} onChange={set("taxId")} slotProps={{ htmlInput: { dir: "ltr" } }} />
          <TextField label={t("notes")} value={form.notes} onChange={set("notes")} multiline minRows={2} />
          {supplier && (
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
              label={t("active")}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!form.name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SupplierDialog;
