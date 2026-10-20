"use client";

import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
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
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { RETURNS_QUERY_KEY, useReturnQuery } from "@/backend-api/returns/hooks";
import { approveReturn, rejectReturn } from "@/backend-api/returns/mutations";
import { REFUNDS_QUERY_KEY, useRefundsQuery } from "@/backend-api/refunds/hooks";
import RefundRequestDialog from "@/features/Refund/RefundRequestDialog";
import RefundsCard from "@/features/Refund/RefundsCard";
import { ORDERS_QUERY_KEY } from "@/backend-api/orders/hooks";
import { useCurrency } from "@/Hooks/useCurrency";
import CustomLink from "@/components/CustomLink";
import ReturnStatusChip from "@/features/Return/ReturnStatusChip";
import { formatDateTime, formatMoney, localized } from "@/features/Order/format";
import { getBackendUri } from "@/utils/helperFunctions";

type Decision = "approve" | "reject";

const AdminReturnPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const fallbackCurrency = useCurrency();

  const { data: ret, isLoading } = useReturnQuery(id);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  // Bumped to open a fresh refund dialog each time.
  const [refundDialog, setRefundDialog] = useState(0);
  const { data: refunds } = useRefundsQuery({ returnId: id, limit: 50 });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("returns"), link: "/admin/returns" },
          { title: ret ? t("returnNumber", { number: ret.returnNumber }) : t("return") },
        ],
        breadCrumbBtns: [],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ret?.returnNumber]);

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: [RETURNS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setDecision(null);
    toast.success(message);
  };
  const onError = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
  };

  const mutation = useMutation({
    mutationFn: async (kind: Decision) => {
      const trimmed = note.trim() || undefined;
      return kind === "approve" ? approveReturn({ id, note: trimmed }) : rejectReturn({ id, note: trimmed });
    },
    onSuccess: (_, kind) => done(t(kind === "approve" ? "returnApproved" : "returnRejected")),
    onError,
  });

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }
  if (!ret) return <Typography color="text.secondary">{t("noData")}</Typography>;

  const currency = localized(ret.orderSummary?.currency, lang) || fallbackCurrency;
  const customer = typeof ret.customer === "object" ? ret.customer : undefined;
  const open = ret.status === "requested" || ret.status === "approved";
  // A return is settled by one refund; while one is open or paid, there's nothing more to ask for.
  const hasRefund = (refunds?.data ?? []).some((r) => ["requested", "approved", "executed"].includes(r.status));
  // Refunds live in the books, so only orders delivered after they started can be refunded here.
  const canRefund = open && !hasRefund && !!ret.orderSummary?.bookedAt;

  const openDialog = (kind: Decision) => {
    setNote("");
    setDecision(kind);
  };

  return (
    <Box py={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Stack spacing={3} flex={1} width="100%">
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} gap={2}>
              <Stack>
                <Typography variant="h6" fontWeight={700}>
                  {t("returnNumber", { number: ret.returnNumber })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(ret.createdAt, lang)} · {t(ret.openedBy === "store" ? "openedByStore" : "openedByCustomer")}
                </Typography>
              </Stack>
              <ReturnStatusChip status={ret.status} size="medium" />
            </Stack>

            <Stack spacing={2}>
              {ret.items.map((item, i) => (
                <Stack key={i} direction="row" spacing={2} alignItems="center">
                  <Avatar variant="rounded" src={item.image ? getBackendUri(item.image) ?? undefined : undefined} sx={{ width: 52, height: 52 }} />
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {localized(item.name, lang)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.variantLabel ? `${item.variantLabel} · ` : ""}
                      {item.quantity} × {formatMoney(item.unitPrice, currency)}
                      {item.restocked ? ` · ${t("restocked")}` : ""}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
                    {formatMoney(item.unitPrice * item.quantity, currency)}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              {t("returnReasonLabel")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`returnReason.${ret.reason}`)}
            </Typography>
            {ret.note && (
              <Typography variant="body2" color="text.secondary" whiteSpace="pre-line" mt={1}>
                “{ret.note}”
              </Typography>
            )}
            {ret.refundAmount != null && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {t("refundedAmount", { amount: formatMoney(ret.refundAmount, currency) })}
              </Alert>
            )}
          </Paper>

          {open && !ret.orderSummary?.bookedAt && (
            <Alert severity="info">{t("refundOutsideBooks")}</Alert>
          )}

          <RefundsCard returnId={id} currency={currency} />

          {open && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {ret.status === "requested" && (
                  <Button variant="outlined" onClick={() => openDialog("approve")}>
                    {t("approve")}
                  </Button>
                )}
                {canRefund && (
                  <Button variant="contained" onClick={() => setRefundDialog((n) => n + 1)}>
                    {t("requestRefund")}
                  </Button>
                )}
                <Button variant="outlined" color="error" onClick={() => openDialog("reject")}>
                  {t("reject")}
                </Button>
              </Stack>
            </Paper>
          )}
        </Stack>

        <Stack spacing={3} width={{ xs: "100%", md: 340 }} flexShrink={0}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              {t("order")}
            </Typography>
            <CustomLink href={`/admin/orders/${ret.order}`}>
              <Typography variant="body2" color="primary" fontWeight={600}>
                #{ret.orderNumber}
              </Typography>
            </CustomLink>
            {ret.orderSummary && (
              <Stack spacing={0.5} mt={1.5}>
                <Row label={t("total")} value={formatMoney(ret.orderSummary.total, currency)} />
                <Row label={t("refunded")} value={formatMoney(ret.orderSummary.refundedTotal ?? 0, currency)} strong />
              </Stack>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              {t("customer")}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {customer?.name ?? "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {customer?.email}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>
              {t("history")}
            </Typography>
            <Stack spacing={1.5}>
              {ret.history.map((h, i) => (
                <Box key={i}>
                  <Typography variant="body2" fontWeight={600}>
                    {t(`returnStatus.${h.status}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatDateTime(h.at, lang)}
                    {typeof h.by === "object" && h.by?.name ? ` · ${h.by.name}` : ""}
                  </Typography>
                  {h.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                      {h.note}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Stack>

      <Dialog open={!!decision} onClose={() => setDecision(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {decision === "approve" ? t("approveReturn") : t("rejectReturn")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} pt={1}>
            <TextField
              label={t("noteToCustomer")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)}>{t("back")}</Button>
          <Button
            variant="contained"
            color={decision === "reject" ? "error" : "primary"}
            disabled={mutation.isPending}
            onClick={() => decision && mutation.mutate(decision)}
          >
            {t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <RefundRequestDialog
        key={refundDialog}
        open={refundDialog > 0}
        onClose={() => setRefundDialog(0)}
        onDone={() => {
          setRefundDialog(0);
          queryClient.invalidateQueries({ queryKey: [REFUNDS_QUERY_KEY] });
        }}
        orderId={ret.order}
        returnId={id}
        lines={ret.items.map((item) => ({
          lineIndex: item.lineIndex,
          quantity: item.quantity,
          label: `${item.quantity} × ${localized(item.name, lang)}${item.variantLabel ? ` (${item.variantLabel})` : ""}`,
        }))}
        defaultReason={ret.reason}
        currency={currency}
      />
    </Box>
  );
};

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={strong ? 700 : 500}>
      {value}
    </Typography>
  </Stack>
);

export default AdminReturnPage;
