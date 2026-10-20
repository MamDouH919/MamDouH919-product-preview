"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from "@mui/material";
import { COURIERS_QUERY_KEY, settleCourier, useCourierQuery } from "@/backend-api/couriers/api";
import { formatDateTime, formatMinorMoney, minorToInput } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";
import { AMOUNT, inputToMinor, toastError } from "@/features/Purchasing/shared";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";

/**
 * A courier hands over the cash they hold. Shows what it is made of, works
 * out what they should hand over after their fee, and asks for a reason
 * when what they hand over is different.
 */
const SettleCourierDialog = ({ courierId, onClose }: { courierId: string | null; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { data: courier } = useCourierQuery(courierId);
  const [fees, setFees] = useState("");
  const [received, setReceived] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");

  const feesMinor = AMOUNT.test(fees) ? inputToMinor(fees) : 0;
  const expected = (courier?.heldMinor ?? 0) - feesMinor;
  const receivedValue = received ?? (courier ? minorToInput(Math.max(expected, 0)) : "");
  const difference = inputToMinor(receivedValue) - expected;
  const valid =
    !!courier && (courier.payments.length > 0 || courier.refunds.length > 0) && (!fees || AMOUNT.test(fees)) && expected >= 0 && AMOUNT.test(receivedValue) && (difference === 0 || !!reason.trim());

  const mutation = useMutation({
    mutationFn: () =>
      settleCourier({
        courierId: courierId!,
        fees: fees || undefined,
        received: receivedValue,
        differenceReason: difference ? reason.trim() : undefined,
        moneyAccountId: moneyAccountId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COURIERS_QUERY_KEY] });
      toast.success(t("courierSettled"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const money = (minor: number) => formatMinorMoney(minor, currency);
  return (
    <Dialog open={!!courierId} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{courier && t("settleCourierTitle", { name: courier.name })}</DialogTitle>
      <DialogContent>
        {courier && (
          <Stack spacing={2} pt={1}>
            <Stack spacing={0.5}>
              <Typography variant="body2">{t("courierCollected", { count: courier.payments.length, amount: money(courier.collectedMinor) })}</Typography>
              {courier.refundsPaidMinor > 0 && (
                <Typography variant="body2">{t("courierRefundsPaid", { count: courier.refunds.length, amount: money(courier.refundsPaidMinor) })}</Typography>
              )}
              <Typography variant="subtitle2" fontWeight={700}>{t("courierHolds", { amount: money(courier.heldMinor) })}</Typography>
            </Stack>
            <TextField
              label={t("courierFee")}
              helperText={t("courierFeeHint")}
              value={fees}
              onChange={(e) => setFees(e.target.value.trim())}
              error={!!fees && !AMOUNT.test(fees)}
              slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
            />
            <TextField
              label={t("cashHandedOver")}
              helperText={t("expectedAmount", { amount: money(Math.max(expected, 0)) })}
              value={receivedValue}
              onChange={(e) => setReceived(e.target.value.trim())}
              error={!AMOUNT.test(receivedValue)}
              slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
            />
            <MoneyAccountSelect value={moneyAccountId} onChange={setMoneyAccountId} label={t("paidInto")} />
            {expected < 0 && <Alert severity="error">{t("courierFeeTooHigh")}</Alert>}
            {difference !== 0 && expected >= 0 && (
              <>
                <Alert severity="warning">{t(difference < 0 ? "settlementShort" : "settlementOver", { amount: money(Math.abs(difference)) })}</Alert>
                <TextField label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} required />
              </>
            )}
            {courier.settlements.length > 0 && (
              <>
                <Divider />
                <Typography variant="subtitle2" fontWeight={700}>{t("recentSettlements")}</Typography>
                {courier.settlements.slice(0, 5).map((s) => (
                  <Typography key={s._id} variant="caption" color="text.secondary">
                    {formatDateTime(s.date, i18n.language)} · #{s.settlementNumber} · {money(s.receivedMinor)}
                    {s.differenceMinor ? ` · ${t("difference")} ${money(s.differenceMinor)}` : ""}
                  </Typography>
                ))}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("settle")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettleCourierDialog;
