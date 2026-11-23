"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { GATEWAY_PAYOUTS_QUERY_KEY, useGatewayPayoutsQuery } from "@/backend-api/payments/hooks";
import { recordGatewayPayout, reverseGatewayPayout } from "@/backend-api/payments/mutations";
import type { GatewayPayout } from "@/backend-api/payments/types";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";
import { useCurrency } from "@/Hooks/useCurrency";
import { formatMinorMoney } from "@/features/Order/format";

const AMOUNT = /^\d+(\.\d{1,2})?$/;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * What the payment gateway paid out to the bank and the fees it kept. Until a
 * payout is recorded the books keep showing that money as held by the gateway.
 */
const GatewayPayoutsCard = () => {
  const { t, i18n } = useTranslation();
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGatewayPayoutsQuery();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [gross, setGross] = useState("");
  const [fee, setFee] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [reversing, setReversing] = useState<GatewayPayout | null>(null);
  const [reason, setReason] = useState("");

  const done = () => queryClient.invalidateQueries({ queryKey: [GATEWAY_PAYOUTS_QUERY_KEY] });
  const onError = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error(Array.isArray(message) ? message.join(", ") : (message ?? t("somethingWentWrong")));
  };

  const record = useMutation({
    mutationFn: recordGatewayPayout,
    onSuccess: () => {
      toast.success(t("payoutRecorded"));
      setOpen(false);
      setGross("");
      setFee("");
      setReference("");
      setNote("");
      done();
    },
    onError,
  });
  const reverse = useMutation({
    mutationFn: reverseGatewayPayout,
    onSuccess: () => {
      toast.success(t("payoutReversed"));
      setReversing(null);
      setReason("");
      done();
    },
    onError,
  });

  if (isError) return null;
  const grossOk = AMOUNT.test(gross) && Number(gross) > 0;
  const feeOk = fee === "" || (AMOUNT.test(fee) && Number(fee) <= Number(gross));
  const net = grossOk && feeOk ? (Number(gross) - Number(fee || 0)).toFixed(2) : null;
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === "ar" ? "ar-EG" : i18n.language === "es" ? "es-ES" : "en-GB");

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {t("payoutsTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("payoutsDescription")}
            </Typography>
          </Box>
          <Button variant="contained" size="small" onClick={() => setOpen(true)} disabled={!data || data.heldMinor <= 0}>
            {t("recordPayout")}
          </Button>
        </Stack>

        {isLoading || !data ? (
          <Stack alignItems="center" py={2}>
            <CircularProgress size={22} />
          </Stack>
        ) : (
          <>
            <Alert severity="info" icon={false}>
              {t("heldByGateway", { amount: formatMinorMoney(data.heldMinor, currency) })}
            </Alert>
            {data.payouts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("noPayouts")}
              </Typography>
            ) : (
              <Stack spacing={1.5} divider={<Divider flexItem />}>
                {data.payouts.map((p) => (
                  <Box key={p._id}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={700}>
                        {t("payoutNumber", { number: p.payoutNumber })} · {dateLabel(p.date)}
                      </Typography>
                      <Stack direction="row" alignItems="center" gap={1}>
                        {p.status === "reversed" && <Chip size="small" color="default" label={t("payoutReversedChip")} />}
                        {p.status === "posted" && (
                          <Button size="small" color="error" onClick={() => setReversing(p)}>
                            {t("reverse")}
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t("payoutAmounts", {
                        gross: formatMinorMoney(p.grossMinor, currency),
                        fee: formatMinorMoney(p.feeMinor, currency),
                        net: formatMinorMoney(p.netMinor, currency),
                      })}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </Typography>
                    {p.status === "reversed" && p.reversalReason && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: "italic" }}>
                        “{p.reversalReason}”
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("recordPayout")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              size="small"
              type="date"
              label={t("payoutDate")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
            />
            <TextField
              size="small"
              label={t("payoutGross")}
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              error={gross !== "" && !grossOk}
              helperText={t("payoutGrossHint")}
              slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" }, input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
            />
            <TextField
              size="small"
              label={t("payoutFee")}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              error={fee !== "" && !feeOk}
              helperText={t("payoutFeeHint")}
              slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" }, input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
            />
            <MoneyAccountSelect value={moneyAccountId} onChange={setMoneyAccountId} label={t("payoutLandedIn")} />
            <TextField size="small" label={t("payoutReference")} value={reference} onChange={(e) => setReference(e.target.value)} />
            <TextField size="small" label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
            {net !== null && <Alert severity="success" icon={false}>{t("payoutNet", { amount: `${net} ${currency}` })}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("back")}</Button>
          <Button
            variant="contained"
            disabled={record.isPending || !grossOk || !feeOk || !date}
            onClick={() =>
              record.mutate({
                date,
                grossAmount: gross,
                feeAmount: fee || undefined,
                moneyAccountId: moneyAccountId || undefined,
                reference: reference.trim() || undefined,
                note: note.trim() || undefined,
              })
            }
          >
            {record.isPending ? <CircularProgress size={18} color="inherit" /> : t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!reversing} onClose={() => setReversing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{reversing && t("payoutReverseConfirm", { number: reversing.payoutNumber })}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" sx={{ mt: 1 }} label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReversing(null)}>{t("back")}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={reverse.isPending || reason.trim().length < 3}
            onClick={() => reversing && reverse.mutate({ id: reversing._id, reason: reason.trim() })}
          >
            {t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default GatewayPayoutsCard;
