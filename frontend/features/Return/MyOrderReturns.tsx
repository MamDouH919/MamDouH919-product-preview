"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import AssignmentReturnOutlined from "@mui/icons-material/AssignmentReturnOutlined";
import { MY_RETURNS_QUERY_KEY, useMyReturnViewQuery } from "@/backend-api/returns/hooks";
import { requestReturn } from "@/backend-api/returns/mutations";
import { formatDateTime, formatMoney, localized } from "@/features/Order/format";
import ReturnStatusChip from "./ReturnStatusChip";
import ReturnRequestDialog from "./ReturnRequestDialog";

/** Returns on a delivered order: what's been asked for, and a way to ask while the window is open. */
export default function MyOrderReturns({ orderId, currency }: { orderId: string; currency: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { data: view } = useMyReturnViewQuery(orderId);
  // Bumped to remount the dialog fresh each time it opens.
  const [dialog, setDialog] = useState(0);

  const mutation = useMutation({
    mutationFn: requestReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MY_RETURNS_QUERY_KEY, orderId] });
      setDialog(0);
      toast.success(t("returnRequested"));
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
    },
  });

  if (!view || (!view.eligible && view.requests.length === 0)) return null;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AssignmentReturnOutlined color="primary" />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              {t("returns")}
            </Typography>
            {view.eligible && view.deadline && (
              <Typography variant="caption" color="text.secondary">
                {t("returnUntil", { date: new Date(view.deadline).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" }) })}
              </Typography>
            )}
          </Box>
        </Stack>
        {view.eligible && (
          <Button variant="outlined" onClick={() => setDialog((n) => n + 1)}>
            {t("requestReturn")}
          </Button>
        )}
      </Stack>

      {view.requests.length > 0 && (
        <Stack spacing={1.5} mt={2.5}>
          {view.requests.map((r) => (
            <Stack key={r._id} direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={600}>
                  {t("returnNumber", { number: r.returnNumber })}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatDateTime(r.createdAt, lang)} ·{" "}
                  {r.items.map((i) => `${i.quantity} × ${localized(i.name, lang)}`).join(", ")}
                </Typography>
                {r.refundAmount != null && (
                  <Typography variant="caption" color="success.main" display="block">
                    {t("refundedAmount", { amount: formatMoney(r.refundAmount, currency) })}
                  </Typography>
                )}
                {/* The store's latest word on it, if any. */}
                {r.history.at(-1)?.note && r.history.at(-1)?.status !== "requested" && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: "italic" }}>
                    {r.history.at(-1)?.note}
                  </Typography>
                )}
              </Box>
              <ReturnStatusChip status={r.status} />
            </Stack>
          ))}
        </Stack>
      )}

      <ReturnRequestDialog
        key={dialog}
        open={dialog > 0}
        orderId={orderId}
        lines={view.lines}
        pending={mutation.isPending}
        title={t("requestReturn")}
        hint={t("returnRequestHint")}
        onClose={() => setDialog(0)}
        onSubmit={(payload) => mutation.mutate(payload)}
      />
    </Paper>
  );
}
