"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ORDER_FINANCE_QUERY_KEY, useOrderFinanceQuery } from "@/backend-api/finance/hooks";
import { recordCollection, voidCollection, writeOffBalance } from "@/backend-api/finance/mutations";
import { useCouriersQuery } from "@/backend-api/couriers/api";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";
import { Custody, OrderPaymentStatus } from "@/backend-api/finance/types";
import { ORDERS_QUERY_KEY } from "@/backend-api/orders/hooks";
import { formatDateTime, formatMinorMoney, minorToInput } from "./format";

const STATUS_COLOR: Record<OrderPaymentStatus, "default" | "warning" | "success" | "info"> = {
  unpaid: "warning",
  partially_paid: "info",
  paid: "success",
  partially_refunded: "info",
  refunded: "default",
  written_off: "default",
  not_tracked: "default",
};

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * The order's money, apart from its delivery status: what it costs, what has
 * been collected and by whom, and what is still owed. Cash is recorded here
 * after delivery; a mistaken entry is voided, never edited.
 */
const OrderPaymentPanel = ({ orderId, currency }: { orderId: string; currency: string }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { data: finance, isError } = useOrderFinanceQuery(orderId);

  const [amount, setAmount] = useState<string | null>(null);
  const [custody, setCustody] = useState<Custody>("store");
  const [courierId, setCourierId] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [writingOff, setWritingOff] = useState(false);
  const { data: couriers } = useCouriersQuery(custody === "courier");
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [ORDER_FINANCE_QUERY_KEY, orderId] });
    queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
  };
  const failed = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error((Array.isArray(message) ? message.join(", ") : message) ?? t("somethingWentWrong"));
  };

  const collect = useMutation({
    mutationFn: recordCollection,
    onSuccess: () => {
      refresh();
      setAmount(null);
      toast.success(t("collectionRecorded"));
    },
    onError: failed,
  });

  const writeOff = useMutation({
    mutationFn: writeOffBalance,
    onSuccess: () => {
      refresh();
      setWritingOff(false);
      setReason("");
      toast.success(t("balanceWrittenOff"));
    },
    onError: failed,
  });

  const voidMutation = useMutation({
    mutationFn: voidCollection,
    onSuccess: () => {
      refresh();
      setVoiding(null);
      setReason("");
      toast.success(t("collectionVoided"));
    },
    onError: failed,
  });

  // No permission to see the books (or nothing to show yet): leave the panel out.
  if (isError || !finance) return null;

  const owed = finance.outstandingMinor;
  const value = amount ?? (owed > 0 ? minorToInput(owed) : "");
  const valid = AMOUNT.test(value) && Number(value) > 0 && (custody === "store" || !!courierId);

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle2" fontWeight={700}>
          {t("payment")}
        </Typography>
        <Chip size="small" color={STATUS_COLOR[finance.paymentStatus]} label={t(`paymentStatus.${finance.paymentStatus}`)} />
      </Stack>

      {!finance.booked ? (
        <Typography variant="body2" color="text.secondary">
          {finance.paymentStatus === "not_tracked" ? t("paymentNotTracked") : t("paymentAfterDelivery")}
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          <Row label={t("total")} value={formatMinorMoney(finance.totalMinor, currency)} />
          <Row label={t("collected")} value={formatMinorMoney(finance.collectedMinor, currency)} />
          {finance.refundedMinor > 0 && (
            <Row label={t("refunded")} value={`− ${formatMinorMoney(finance.refundedMinor, currency)}`} />
          )}
          {finance.creditedMinor > 0 && (
            <Row label={t("creditedAgainstBalance")} value={formatMinorMoney(finance.creditedMinor, currency)} />
          )}
          {finance.writtenOffMinor > 0 && (
            <Row label={t("writtenOff")} value={formatMinorMoney(finance.writtenOffMinor, currency)} />
          )}
          <Row label={t("outstanding")} value={formatMinorMoney(owed, currency)} strong />
        </Stack>
      )}

      {finance.booked && owed > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label={t("amountCollected")}
              value={value}
              onChange={(e) => setAmount(e.target.value.trim())}
              error={!!value && !valid}
              inputProps={{ inputMode: "decimal", dir: "ltr" }}
            />
            <TextField select size="small" label={t("collectedBy")} value={custody} onChange={(e) => setCustody(e.target.value as Custody)}>
              <MenuItem value="store">{t("custody.store")}</MenuItem>
              <MenuItem value="courier">{t("custody.courier")}</MenuItem>
            </TextField>
            {custody === "store" && <MoneyAccountSelect value={moneyAccountId} onChange={setMoneyAccountId} />}
            {custody === "courier" && (
              <TextField
                select
                size="small"
                label={t("courier")}
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                helperText={couriers && !couriers.some((c) => c.isActive) ? t("noCouriersYet") : " "}
              >
                {(couriers ?? []).filter((c) => c.isActive).map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="contained"
              disabled={!valid || collect.isPending}
              onClick={() =>
                collect.mutate({
                  orderId,
                  amount: value,
                  custody,
                  courierId: custody === "courier" ? courierId : undefined,
                  moneyAccountId: custody === "store" ? moneyAccountId || undefined : undefined,
                })
              }
            >
              {t("recordCollection")}
            </Button>
            <Button size="small" color="warning" onClick={() => setWritingOff(true)}>
              {t("writeOffBalance")}
            </Button>
          </Stack>
        </>
      )}

      {finance.payments.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.25}>
            {finance.payments.map((p) => (
              <Stack key={p._id} direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Box sx={{ opacity: p.status === "voided" ? 0.6 : 1 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ textDecoration: p.status === "voided" ? "line-through" : "none" }}>
                    {formatMinorMoney(p.amountMinor, currency)} · {t(`custody.${p.custody}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(p.collectedAt, lang)}
                    {p.status === "voided" && p.voidReason ? ` · ${t("voided")}: ${p.voidReason}` : ""}
                  </Typography>
                </Box>
                {p.status === "collected" && (
                  <Button size="small" color="error" onClick={() => setVoiding(p._id)}>
                    {t("void")}
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </>
      )}

      <Dialog open={writingOff} onClose={() => setWritingOff(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("writeOffBalance")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("writeOffHint", { amount: formatMinorMoney(owed, currency) })}
          </Typography>
          <TextField fullWidth size="small" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWritingOff(false)}>{t("cancel")}</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={!reason.trim() || writeOff.isPending}
            onClick={() => writeOff.mutate({ orderId, reason: reason.trim() })}
          >
            {t("writeOff")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!voiding} onClose={() => setVoiding(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t("voidCollectionTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("voidCollectionHint")}
          </Typography>
          <TextField fullWidth size="small" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoiding(null)}>{t("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!reason.trim() || voidMutation.isPending}
            onClick={() => voiding && voidMutation.mutate({ paymentId: voiding, reason: reason.trim() })}
          >
            {t("void")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={strong ? 700 : 500} sx={{ fontVariantNumeric: "tabular-nums" }}>
      {value}
    </Typography>
  </Stack>
);

export default OrderPaymentPanel;
