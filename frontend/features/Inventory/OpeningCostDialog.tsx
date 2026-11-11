"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { correctOpeningCost, setOpeningCost } from "@/backend-api/inventory/mutations";
import { StockLevel } from "@/backend-api/inventory/types";
import { formatMinorMoney } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";
import CostPercentages, { addCostPercentages } from "@/components/CostPercentages";

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Gives stock from before the books its cost: what one unit on the shelf
 * really cost. Done once per item; after that, costs come from purchases.
 * With `correct`, fixes that cost instead — the server allows it only while
 * nothing but the opening has touched the stock.
 */
const OpeningCostDialog = ({
  row,
  correct = false,
  onClose,
}: {
  row: StockLevel | null;
  correct?: boolean;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const [unitCost, setUnitCost] = useState("");
  const [rates, setRates] = useState<number[]>([]);

  const mutation = useMutation({
    mutationFn: correct ? correctOpeningCost : setOpeningCost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(t("saveSuccessfully"));
      setUnitCost("");
      setRates([]);
      onClose();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) ?? t("somethingWentWrong"));
    },
  });

  const valid = AMOUNT.test(unitCost);
  // What is saved: the typed cost with the switched-on percentages added.
  const cost = valid ? addCostPercentages(unitCost, rates) : unitCost;
  const total = valid && row ? Math.max(row.stock, 0) * Math.round(Number(cost) * 100) : 0;
  const atOrAbovePrice = valid && row?.price !== undefined && row.price > 0 && Number(cost) >= row.price;
  const name = row ? (row.name[i18n.language] ?? row.name.en ?? "") + (row.variantLabel ? ` (${row.variantLabel})` : "") : "";

  return (
    <Dialog open={!!row} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(correct ? "correctOpeningCostFor" : "setOpeningCostFor", { name })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <Alert severity="info">{t(correct ? "correctOpeningCostHint" : "openingCostHint")}</Alert>
          {correct && row?.unitCostMinor !== null && row?.unitCostMinor !== undefined && (
            <Alert severity="warning" icon={false}>
              {t("currentUnitCost", { cost: formatMinorMoney(row.unitCostMinor, currency) })}
            </Alert>
          )}
          <TextField
            label={t("unitCost")}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value.trim())}
            error={!!unitCost && !valid}
            helperText={row && valid ? t("openingCostTotal", { units: Math.max(row.stock, 0), total: formatMinorMoney(total, currency) }) : " "}
            slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
            autoFocus
          />
          <CostPercentages cost={valid ? unitCost : ""} value={rates} onChange={setRates} />
          {atOrAbovePrice && <Alert severity="warning">{t("costAtOrAbovePrice")}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button
          variant="contained"
          disabled={!valid || mutation.isPending || !row}
          onClick={() => row && mutation.mutate({ productId: row.productId, variantId: row.variantId, unitCost: cost })}
        >
          {t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OpeningCostDialog;
