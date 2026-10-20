"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Add from "@mui/icons-material/Add";
import { useProductsQuery } from "@/backend-api/products/hooks";
import { useSuppliersQuery, PURCHASES_QUERY_KEY } from "@/backend-api/purchasing/hooks";
import { createPurchase, updatePurchase } from "@/backend-api/purchasing/mutations";
import { Purchase, PurchaseInput } from "@/backend-api/purchasing/types";
import { formatMinorMoney, minorToInput } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";
import { AMOUNT, inputToMinor, toastError, todayInput } from "./shared";

type Option = { productId: string; variantId?: string; label: string; tracked?: boolean };
type Line = { key: number; option: Option | null; quantity: string; unitCost: string };

/**
 * Enters a purchase as a draft — nothing moves until it is posted. With
 * `purchase`, edits that draft. Mount with a fresh `key` per opening.
 */
const PurchaseFormDialog = ({ open, purchase, onClose, onSaved }: { open: boolean; purchase?: Purchase; onClose: () => void; onSaved: (p: Purchase) => void }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { data: suppliers } = useSuppliersQuery();
  const { data: products } = useProductsQuery();

  // One option per product, or per variant where it has them. Products that
  // don't track stock are listed but can't be picked: a purchase puts units
  // into stock at a cost, and they have no stock to put them in.
  const options = useMemo<Option[]>(
    () =>
      (products ?? [])
        .flatMap((p) => {
          const name = p.name[lang] ?? p.name.en ?? p.name.ar ?? "";
          return p.variants?.length
            ? p.variants.map((v) => ({ productId: p._id, variantId: v._id, label: `${name} — ${v.label}`, tracked: p.trackStock }))
            : [{ productId: p._id, label: name, tracked: p.trackStock }];
        })
        .sort((a, b) => Number(b.tracked) - Number(a.tracked)),
    [products, lang],
  );

  let nextKey = 0;
  const [supplierId, setSupplierId] = useState(typeof purchase?.supplier === "object" ? purchase.supplier._id : (purchase?.supplier ?? ""));
  const [invoiceNo, setInvoiceNo] = useState(purchase?.supplierInvoiceNo ?? "");
  const [date, setDate] = useState(purchase ? purchase.date.slice(0, 10) : todayInput());
  const [landed, setLanded] = useState(purchase ? minorToInput(purchase.landedCostMinor) : "");
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    purchase
      ? purchase.lines.map((l) => ({
          key: nextKey++,
          option: { productId: l.product, variantId: l.variantId, label: `${l.name[lang] ?? l.name.en ?? ""}${l.variantLabel ? ` — ${l.variantLabel}` : ""}` },
          quantity: String(l.quantity),
          unitCost: minorToInput(l.unitCostMinor),
        }))
      : [{ key: nextKey++, option: null, quantity: "1", unitCost: "" }],
  );
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const linesOk = lines.length > 0 && lines.every((l) => l.option && /^\d+$/.test(l.quantity) && Number(l.quantity) > 0 && AMOUNT.test(l.unitCost));
  const landedOk = !landed || AMOUNT.test(landed);
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * inputToMinor(l.unitCost), 0);
  const total = subtotal + (landedOk ? inputToMinor(landed) : 0);

  const mutation = useMutation({
    mutationFn: () => {
      const body: PurchaseInput = {
        supplierId,
        supplierInvoiceNo: invoiceNo.trim() || undefined,
        date: new Date(date).toISOString(),
        landedCost: landed || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({ productId: l.option!.productId, variantId: l.option!.variantId, quantity: Number(l.quantity), unitCost: l.unitCost })),
      };
      return purchase ? updatePurchase({ id: purchase._id, ...body }) : createPurchase(body);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: [PURCHASES_QUERY_KEY] });
      toast.success(t("purchaseSavedAsDraft"));
      onSaved(saved);
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t(purchase ? "editPurchase" : "newPurchase")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("supplier")} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} sx={{ flex: 2 }} required>
              {(suppliers ?? []).filter((s) => s.isActive || s._id === supplierId).map((s) => (
                <MenuItem key={s._id} value={s._id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={t("supplierInvoiceNo")} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} sx={{ flex: 1 }} />
            <TextField
              label={t("receivedOn")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              sx={{ flex: 1 }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayInput() } }}
            />
          </Stack>

          <Divider />
          {lines.map((line) => (
            <Stack key={line.key} direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <Autocomplete
                sx={{ flex: 3 }}
                options={options}
                value={line.option}
                isOptionEqualToValue={(a, b) => a.productId === b.productId && a.variantId === b.variantId}
                getOptionDisabled={(o) => o.tracked === false}
                getOptionLabel={(o) => (o.tracked === false ? `${o.label} — ${t("stockNotTrackedShort")}` : o.label)}
                noOptionsText={t("noProductsToBuy")}
                onChange={(_, value) => update(line.key, { option: value })}
                renderInput={(params) => <TextField {...params} size="small" label={t("product")} />}
              />
              <TextField size="small" label={t("quantity")} value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value.trim() })} sx={{ flex: 1 }} slotProps={{ htmlInput: { inputMode: "numeric", dir: "ltr" } }} />
              <TextField
                size="small"
                label={t("unitCost")}
                value={line.unitCost}
                onChange={(e) => update(line.key, { unitCost: e.target.value.trim() })}
                error={!!line.unitCost && !AMOUNT.test(line.unitCost)}
                sx={{ flex: 1 }}
                slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
              />
              <IconButton onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))} disabled={lines.length === 1}>
                <Delete />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<Add />} onClick={() => setLines((ls) => [...ls, { key: Date.now(), option: null, quantity: "1", unitCost: "" }])} sx={{ alignSelf: "flex-start" }}>
            {t("addLine")}
          </Button>

          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={t("landedCost")}
              helperText={t("landedCostHint")}
              value={landed}
              onChange={(e) => setLanded(e.target.value.trim())}
              error={!landedOk}
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
            />
            <TextField label={t("notes")} value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ flex: 2 }} />
          </Stack>
          <Typography variant="subtitle1" fontWeight={700} textAlign="end">
            {t("total")}: {formatMinorMoney(total, currency)}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!supplierId || !linesOk || !landedOk || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("saveDraft")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PurchaseFormDialog;
