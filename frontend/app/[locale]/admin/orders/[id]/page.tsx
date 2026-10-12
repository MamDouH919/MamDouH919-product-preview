"use client";

import { use, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { ORDERS_QUERY_KEY, useOrderByIdQuery } from "@/backend-api/orders/hooks";
import { updateOrderStatus } from "@/backend-api/orders/mutations";
import { NEXT_STATUSES, OrderStatus } from "@/backend-api/orders/types";
import { useCurrency } from "@/Hooks/useCurrency";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import OrderLines from "@/features/Order/OrderLines";
import ShippingAddressBlock from "@/features/Order/ShippingAddressBlock";
import StatusTimeline from "@/features/Order/StatusTimeline";
import { formatDateTime, localized } from "@/features/Order/format";

const AdminOrderPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const fallbackCurrency = useCurrency();

  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");

  const { data: order, isLoading } = useOrderByIdQuery(id);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("orders"), link: `/admin/orders` },
          { title: order ? `#${order.orderNumber}` : t("order") },
        ],
        breadCrumbBtns: [],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.orderNumber]);

  const statusMutation = useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
      // Cancelling returns stock, so the inventory screens are stale too.
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setTarget(null);
      setNote("");
      toast.success(t("saveSuccessfully"));
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_KEY] });
      setTarget(null);
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong"));
    },
  });

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }

  if (!order) {
    return <Typography color="text.secondary">{t("orderNotFound")}</Typography>;
  }

  const currency = localized(order.currency, lang) || fallbackCurrency;
  const customer = typeof order.customer === "object" ? order.customer : undefined;
  const next = NEXT_STATUSES[order.status];

  return (
    <Box py={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Stack spacing={3} flex={1} width="100%">
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
              <Stack>
                <Typography variant="h6" fontWeight={700}>
                  #{order.orderNumber}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(order.createdAt, lang)}
                </Typography>
              </Stack>
              <OrderStatusChip status={order.status} size="medium" />
            </Stack>

            <OrderLines
              lines={order.items.map((item, i) => ({ key: String(i), ...item }))}
              subtotal={order.subtotal}
              shippingFee={order.shippingFee}
              total={order.total}
              currency={currency}
            />
          </Paper>

          {next.length > 0 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>
                {t("updateStatus")}
              </Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {next.map((status) => (
                  <Button
                    key={status}
                    variant={status === "cancelled" ? "outlined" : "contained"}
                    color={status === "cancelled" ? "error" : "primary"}
                    onClick={() => setTarget(status)}
                  >
                    {t(`orderAction.${status}`)}
                  </Button>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>

        <Stack spacing={3} width={{ xs: "100%", md: 360 }} flexShrink={0}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              {t("customer")}
            </Typography>
            {customer ? (
              <Stack spacing={0.25}>
                <Typography variant="body2" fontWeight={600}>
                  {customer.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {customer.email}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">—</Typography>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              {t("deliveryAddress")}
            </Typography>
            <ShippingAddressBlock address={order.shippingAddress} />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
              {t("paymentMethod")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`paymentMethods.${order.paymentMethod}`)}
            </Typography>

            {order.notes && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                  {t("orderNotes")}
                </Typography>
                <Typography variant="body2" color="text.secondary" whiteSpace="pre-line">
                  {order.notes}
                </Typography>
              </>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>
              {t("history")}
            </Typography>
            <StatusTimeline history={order.statusHistory ?? []} />
          </Paper>
        </Stack>
      </Stack>

      <Dialog open={!!target} onClose={() => setTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>{target && t(`orderAction.${target}`)}</DialogTitle>
        <DialogContent>
          {target === "cancelled" && (
            <DialogContentText mb={2}>{t("cancelOrderRestockHint")}</DialogContentText>
          )}
          <TextField
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 1 }}
            label={t("noteOptional")}
            placeholder={target === "shipped" ? t("shippedNotePlaceholder") : undefined}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>{t("back")}</Button>
          <Button
            variant="contained"
            color={target === "cancelled" ? "error" : "primary"}
            disabled={statusMutation.isPending}
            onClick={() =>
              target && statusMutation.mutate({ id: order._id, status: target, note: note.trim() || undefined })
            }
          >
            {t("confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminOrderPage;
