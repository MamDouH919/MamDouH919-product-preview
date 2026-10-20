"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { REFUNDS_QUERY_KEY, useRefundsQuery } from "@/backend-api/refunds/hooks";
import { approveRefund, executeRefund, rejectRefund, reverseRefund } from "@/backend-api/refunds/mutations";
import { Refund } from "@/backend-api/refunds/types";
import { ORDER_FINANCE_QUERY_KEY } from "@/backend-api/finance/hooks";
import { ORDERS_QUERY_KEY } from "@/backend-api/orders/hooks";
import { RETURNS_QUERY_KEY } from "@/backend-api/returns/hooks";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";
import RefundStatusChip from "./RefundStatusChip";

type Action = "approve" | "reject" | "execute" | "reverse";

const name = (who?: { name: string } | string) => (typeof who === "object" ? who?.name : undefined);

/**
 * The refunds on an order or a return, with what each one is waiting for.
 * Approving, paying out and reversing are separate permissions on the
 * server; a button someone isn't allowed to use answers with the reason.
 */
const RefundsCard = ({
  orderId,
  returnId,
  currency,
  action,
}: {
  orderId?: string;
  returnId?: string;
  currency: string;
  /** Something next to the title, e.g. the button that asks for a refund. */
  action?: React.ReactNode;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { data, isError } = useRefundsQuery({ orderId, returnId, limit: 50 });
  const [pending, setPending] = useState<{ refund: Refund; action: Action } | null>(null);
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: async ({ refund, action }: { refund: Refund; action: Action }) => {
      const note = text.trim() || undefined;
      if (action === "approve") return approveRefund({ id: refund._id, note });
      if (action === "reject") return rejectRefund({ id: refund._id, note });
      if (action === "execute") return executeRefund(refund._id);
      return reverseRefund({ id: refund._id, reason: text.trim() });
    },
    onSuccess: (_, { action }) => {
      for (const key of [REFUNDS_QUERY_KEY, ORDER_FINANCE_QUERY_KEY, ORDERS_QUERY_KEY, RETURNS_QUERY_KEY, "inventory"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setPending(null);
      setText("");
      toast.success(t(`refundDone.${action}`));
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) ?? t("somethingWentWrong"));
    },
  });

  if (isError) return null;
  const refunds = data?.data ?? [];
  if (!refunds.length && !action) return null;

  const actionsFor = (refund: Refund): Action[] =>
    refund.status === "requested"
      ? ["approve", "reject"]
      : refund.status === "approved"
        ? ["execute", "reject"]
        : refund.status === "executed"
          ? ["reverse"]
          : [];

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={refunds.length ? 1.5 : 0}>
        <Typography variant="subtitle2" fontWeight={700}>
          {t("refunds")}
        </Typography>
        {action}
      </Stack>
      <Stack spacing={1.5} divider={<Divider flexItem />}>
        {refunds.map((refund) => (
          <Box key={refund._id}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight={700}>
                {t("refundNumber", { number: refund.refundNumber })} · {formatMinorMoney(refund.totalMinor, currency)}
              </Typography>
              <RefundStatusChip status={refund.status} />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block">
              {t(`refundMethod.${refund.method}`)} · {t(`refundReason.${refund.reason}`)}
              {refund.deliveryMinor > 0 ? ` · ${t("includesDelivery", { amount: formatMinorMoney(refund.deliveryMinor, currency) })}` : ""}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {formatDateTime(refund.executedAt ?? refund.createdAt, lang)}
              {name(refund.requestedBy) ? ` · ${t("requestedByName", { name: name(refund.requestedBy) })}` : ""}
              {refund.autoApproved ? ` · ${t("autoApproved")}` : name(refund.approvedBy) ? ` · ${t("approvedByName", { name: name(refund.approvedBy) })}` : ""}
            </Typography>
            {refund.note && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }} display="block">
                “{refund.note}”
              </Typography>
            )}
            {actionsFor(refund).length > 0 && (
              <Stack direction="row" spacing={1} mt={1}>
                {actionsFor(refund).map((a) => (
                  <Button
                    key={a}
                    size="small"
                    variant={a === "execute" || a === "approve" ? "contained" : "outlined"}
                    color={a === "reject" || a === "reverse" ? "error" : "primary"}
                    onClick={() => {
                      setText("");
                      setPending({ refund, action: a });
                    }}
                  >
                    {t(`refundAction.${a}`)}
                  </Button>
                ))}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>

      <Dialog open={!!pending} onClose={() => setPending(null)} fullWidth maxWidth="xs">
        <DialogTitle>{pending && t(`refundConfirm.${pending.action}`, { number: pending.refund.refundNumber })}</DialogTitle>
        <DialogContent>
          {pending?.action === "execute" && (
            <Typography variant="body2" color="text.secondary">
              {t("refundExecuteHint", {
                amount: formatMinorMoney(pending.refund.totalMinor, currency),
                method: t(`refundMethod.${pending.refund.method}`),
              })}
            </Typography>
          )}
          {pending && pending.action !== "execute" && (
            <TextField
              fullWidth
              size="small"
              sx={{ mt: 1 }}
              label={t(pending.action === "reverse" ? "reason" : "note")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>{t("back")}</Button>
          <Button
            variant="contained"
            color={pending?.action === "reject" || pending?.action === "reverse" ? "error" : "primary"}
            disabled={mutation.isPending || (pending?.action === "reverse" && !text.trim())}
            onClick={() => pending && mutation.mutate(pending)}
          >
            {t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default RefundsCard;
