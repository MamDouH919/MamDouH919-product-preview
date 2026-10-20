"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRefundPreviewQuery } from "@/backend-api/refunds/hooks";
import { requestRefund } from "@/backend-api/refunds/mutations";
import { REFUND_METHODS, REFUND_REASONS, Refund, RefundMethod, RefundReason } from "@/backend-api/refunds/types";
import { formatMinorMoney, minorToInput } from "@/features/Order/format";
import { useCouriersQuery } from "@/backend-api/couriers/api";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";

const AMOUNT = /^\d+(\.\d{1,2})?$/;
const toMinor = (text: string) => Math.round(Number(text) * 100);

export type RefundableLine = { lineIndex: number; quantity: number; label: string };

/**
 * Asks for a refund. The server works out what the lines are worth and what
 * the delivery-fee policy gives back; the person asking can lower or raise
 * those within the caps, and anything beyond the policy goes to an approver
 * with a note. Small refunds within policy are approved as they are asked for.
 */
const RefundRequestDialog = ({
  open,
  onClose,
  onDone,
  orderId,
  returnId,
  lines,
  defaultReason,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (refund: Refund) => void;
  orderId: string;
  returnId?: string;
  lines: RefundableLine[];
  defaultReason: RefundReason;
  currency: string;
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<RefundReason>(defaultReason);
  // Damaged goods stay off the shelf unless someone says otherwise.
  const [restock, setRestock] = useState<number[]>(defaultReason === "damaged" ? [] : lines.map((l) => l.lineIndex));
  const [productAmount, setProductAmount] = useState<string | null>(null);
  const [deliveryAmount, setDeliveryAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<RefundMethod>("cash");
  const [courierId, setCourierId] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const { data: couriers } = useCouriersQuery(method === "courier_cash");
  const [note, setNote] = useState("");

  const basis = useMemo(
    () =>
      open
        ? { orderId, returnId, reason, lines: lines.map((l) => ({ lineIndex: l.lineIndex, quantity: l.quantity, restock: restock.includes(l.lineIndex) })) }
        : null,
    [open, orderId, returnId, reason, lines, restock],
  );
  const { data: preview, isFetching, error } = useRefundPreviewQuery(basis);

  const product = productAmount ?? (preview ? minorToInput(preview.productSuggestedMinor) : "");
  const delivery = deliveryAmount ?? (preview ? minorToInput(preview.deliverySuggestedMinor) : "");
  const productOk = AMOUNT.test(product) && !!preview && toMinor(product) <= preview.productMaxMinor;
  const deliveryOk = AMOUNT.test(delivery) && !!preview && toMinor(delivery) <= preview.deliveryMaxMinor;
  const totalMinor = (productOk ? toMinor(product) : 0) + (deliveryOk ? toMinor(delivery) : 0);
  const beyondPolicy = !!preview && deliveryOk && toMinor(delivery) > preview.deliverySuggestedMinor;
  const needsApproval = !!preview && (beyondPolicy || totalMinor > preview.rules.autoApproveUpToMinor);
  const methodRoom = (m: RefundMethod) =>
    !preview ? 0 : m === "credit_against_receivable" ? preview.creditRemainingMinor : preview.cashRemainingMinor;
  const valid = productOk && deliveryOk && totalMinor > 0 && totalMinor <= methodRoom(method) && (!beyondPolicy || !!note.trim()) && (method !== "courier_cash" || !!courierId);

  const mutation = useMutation({
    mutationFn: requestRefund,
    onSuccess: (refund) => {
      toast.success(t(refund.status === "approved" ? "refundApprovedAutomatically" : "refundRequested"));
      onDone(refund);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) ?? t("somethingWentWrong"));
    },
  });

  const serverError = (error as any)?.response?.data?.message;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("requestRefund")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} pt={1}>
          <TextField select label={t("refundReasonLabel")} value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
            {REFUND_REASONS.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`refundReason.${r}`)}
              </MenuItem>
            ))}
          </TextField>

          {/* Only lines where goods come back can go back on the shelf; an allowance has none. */}
          {lines.some((l) => l.quantity > 0) && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {t("putBackInStock")}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                {t("putBackInStockHint")}
              </Typography>
              {lines.filter((l) => l.quantity > 0).map((line) => {
                const info = preview?.lines.find((l) => l.lineIndex === line.lineIndex);
                return (
                  <FormControlLabel
                    key={line.lineIndex}
                    sx={{ display: "flex" }}
                    control={
                      <Checkbox
                        disabled={info ? !info.restockable : false}
                        checked={restock.includes(line.lineIndex)}
                        onChange={(e) =>
                          setRestock((prev) => (e.target.checked ? [...prev, line.lineIndex] : prev.filter((x) => x !== line.lineIndex)))
                        }
                      />
                    }
                    label={`${line.label}${info ? ` — ${formatMinorMoney(info.suggestedMinor, currency)}` : ""}`}
                  />
                );
              })}
            </Box>
          )}

          {serverError && <Alert severity="error">{Array.isArray(serverError) ? serverError[0] : serverError}</Alert>}

          {preview && (
            <>
              <TextField
                label={t("refundProductAmount")}
                value={product}
                onChange={(e) => setProductAmount(e.target.value.trim())}
                error={!productOk}
                helperText={t("refundAmountRange", {
                  suggested: formatMinorMoney(preview.productSuggestedMinor, currency),
                  max: formatMinorMoney(preview.productMaxMinor, currency),
                })}
                slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" }, input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
              />
              <TextField
                label={t("refundDeliveryAmount")}
                value={delivery}
                onChange={(e) => setDeliveryAmount(e.target.value.trim())}
                error={!deliveryOk}
                helperText={t(`deliveryPolicyHint.${preview.rules.deliveryFeeRefund}`, {
                  allowed: formatMinorMoney(preview.deliverySuggestedMinor, currency),
                  max: formatMinorMoney(preview.deliveryMaxMinor, currency),
                })}
                slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" }, input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
              />
              <TextField select label={t("refundMethodLabel")} value={method} onChange={(e) => setMethod(e.target.value as RefundMethod)}>
                {REFUND_METHODS.map((m) => (
                  <MenuItem key={m} value={m} disabled={methodRoom(m) <= 0}>
                    {t(`refundMethod.${m}`)} ({t("upTo")} {formatMinorMoney(Math.max(0, methodRoom(m)), currency)})
                  </MenuItem>
                ))}
              </TextField>
              {method === "cash" && <MoneyAccountSelect value={moneyAccountId} onChange={setMoneyAccountId} label={t("paidFrom")} />}
              {method === "courier_cash" && (
                <TextField select label={t("courier")} value={courierId} onChange={(e) => setCourierId(e.target.value)}>
                  {(couriers ?? []).filter((c) => c.isActive).map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {beyondPolicy && <Alert severity="warning">{t("refundBeyondPolicy")}</Alert>}
              <Alert severity={needsApproval ? "info" : "success"}>
                {t(needsApproval ? "refundNeedsApproval" : "refundAutoApproves", { total: formatMinorMoney(totalMinor, currency) })}
              </Alert>
            </>
          )}

          <TextField
            label={t(beyondPolicy ? "refundNoteRequired" : "note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button
          variant="contained"
          disabled={!valid || mutation.isPending || isFetching}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          onClick={() =>
            basis &&
            mutation.mutate({
              ...basis,
              productAmount: product,
              deliveryAmount: delivery,
              method,
              courierId: method === "courier_cash" ? courierId : undefined,
              moneyAccountId: method === "cash" ? moneyAccountId || undefined : undefined,
              note: note.trim() || undefined,
            })
          }
        >
          {t("requestRefund")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RefundRequestDialog;
