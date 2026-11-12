"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  INVENTORY_QUERY_KEY,
  MOVEMENTS_QUERY_KEY,
  TRANSFERS_QUERY_KEY,
  WAREHOUSES_QUERY_KEY,
  useStockLevelsQuery,
  useWarehousesQuery,
} from "@/backend-api/inventory/hooks";
import { createTransfer } from "@/backend-api/inventory/mutations";
import { StockLevel } from "@/backend-api/inventory/types";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { toastError } from "@/features/Purchasing/shared";
import { warehouseName } from "./warehouseName";

type Line = { key: number; row: StockLevel | null; quantity: string };

let lineSeq = 0;
const blankLine = (): Line => ({ key: ++lineSeq, row: null, quantity: "" });

const keyOf = (row: StockLevel) => `${row.productId}:${row.variantId ?? ""}`;
const unitsIn = (row: StockLevel, warehouseId: string) => row.stocks.find((e) => e.warehouseId === warehouseId)?.qty ?? 0;

/**
 * Moves units from one warehouse to another in one step — numbers only: the
 * stock's value and the books don't change. What the move cost goes in as an
 * expense. Mount with a fresh `key` per opening.
 */
const TransferDialog = ({ onClose, initialFrom }: { onClose: () => void; initialFrom?: string }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { data: warehousesData } = useWarehousesQuery();
  const warehouses = (warehousesData?.data ?? []).filter((w) => w.isActive);

  const main = warehouses.find((w) => w.isMain);
  const firstOther = warehouses.find((w) => !w.isMain);
  const [from, setFrom] = useState(initialFrom ?? firstOther?._id ?? "");
  const [to, setTo] = useState(main?._id ?? "");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [blankLine()]);

  // The warehouse list arrives after the first render; pick defaults once it does.
  const fromId = from || firstOther?._id || "";
  const toId = to || (main && main._id !== fromId ? main._id : warehouses.find((w) => w._id !== fromId)?._id) || "";

  const { data: levels, isLoading } = useStockLevelsQuery(fromId ? { warehouseId: fromId } : undefined);
  const options = (levels ?? []).filter((row) => row.trackStock && unitsIn(row, fromId) > 0);

  const label = (row: StockLevel) =>
    `${row.name[lang] ?? row.name.en ?? row.name.ar ?? ""}${row.variantLabel ? ` — ${row.variantLabel}` : ""}${row.sku ? ` (${row.sku})` : ""}`;

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const problems = lines.map((line) => {
    if (!line.row) return null;
    const q = Number(line.quantity);
    if (!line.quantity || !Number.isInteger(q) || q <= 0) return t("positiveQuantityHint");
    const available = unitsIn(line.row, fromId);
    return q > available ? t("transferTooMany", { available }) : null;
  });
  const filled = lines.filter((l) => l.row);
  const chosen = new Set(filled.map((l) => keyOf(l.row!)));
  const canSubmit =
    fromId && toId && fromId !== toId && filled.length > 0 && chosen.size === filled.length && problems.every((p) => !p);

  const mutation = useMutation({
    mutationFn: () =>
      createTransfer({
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        lines: filled.map((l) => ({ productId: l.row!.productId, variantId: l.row!.variantId, quantity: Number(l.quantity) })),
        note: note.trim() || undefined,
      }),
    onSuccess: (transfer) => {
      for (const key of [INVENTORY_QUERY_KEY, MOVEMENTS_QUERY_KEY, TRANSFERS_QUERY_KEY, WAREHOUSES_QUERY_KEY, PRODUCTS_QUERY_KEY]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(t("transferDone", { number: transfer.transferNumber }));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("newTransfer")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          {warehouses.length < 2 && <Alert severity="info">{t("transferNeedsTwo")}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <TextField
              select
              fullWidth
              label={t("fromWarehouse")}
              value={fromId}
              onChange={(e) => {
                setFrom(e.target.value);
                setLines([blankLine()]);
              }}
            >
              {warehouses.map((w) => (
                <MenuItem key={w._id} value={w._id}>
                  {warehouseName(w, lang)}
                </MenuItem>
              ))}
            </TextField>
            <SwapHorizIcon color="action" />
            <TextField select fullWidth label={t("toWarehouse")} value={toId} onChange={(e) => setTo(e.target.value)}>
              {warehouses
                .filter((w) => w._id !== fromId)
                .map((w) => (
                  <MenuItem key={w._id} value={w._id}>
                    {warehouseName(w, lang)}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>

          {lines.map((line, i) => (
            <Stack key={line.key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
              <Autocomplete
                fullWidth
                size="small"
                loading={isLoading}
                options={options}
                value={line.row}
                getOptionLabel={label}
                isOptionEqualToValue={(a, b) => keyOf(a) === keyOf(b)}
                getOptionDisabled={(row) => chosen.has(keyOf(row)) && keyOf(row) !== (line.row && keyOf(line.row))}
                onChange={(_, row) => setLine(line.key, { row })}
                renderOption={(props, row) => (
                  <li {...props} key={keyOf(row)}>
                    <Stack direction="row" justifyContent="space-between" width="100%" spacing={2}>
                      <span>{label(row)}</span>
                      <Typography variant="body2" color="text.secondary">
                        {unitsIn(row, fromId)}
                      </Typography>
                    </Stack>
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label={t("product")} />}
                noOptionsText={t("noStockInWarehouse")}
              />
              <TextField
                size="small"
                type="number"
                label={t("quantity")}
                value={line.quantity}
                onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                error={!!problems[i]}
                helperText={problems[i] ?? (line.row ? `${t("available")}: ${unitsIn(line.row, fromId)}` : " ")}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                sx={{ width: { sm: 180 } }}
              />
              <IconButton
                aria-label={t("delete")}
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          ))}
          <Button
            sx={{ alignSelf: "flex-start" }}
            onClick={() => setLines((ls) => [...ls, blankLine()])}
          >
            {t("addLine")}
          </Button>

          <TextField label={t("notes")} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          <Alert severity="info">{t("transferCostHint")}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("transfer")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransferDialog;
