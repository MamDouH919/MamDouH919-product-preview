"use client";

import { Suspense, use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
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
import ArrowBack from "@mui/icons-material/ArrowBack";
import { MY_ORDERS_QUERY_KEY, useMyOrderQuery } from "@/backend-api/orders/hooks";
import { cancelMyOrder } from "@/backend-api/orders/mutations";
import { useCurrency } from "@/Hooks/useCurrency";
import CustomLink from "@/components/CustomLink";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import OrderLines from "@/features/Order/OrderLines";
import ShippingAddressBlock from "@/features/Order/ShippingAddressBlock";
import StatusTimeline from "@/features/Order/StatusTimeline";
import { formatDateTime, localized } from "@/features/Order/format";
import MyOrderReturns from "@/features/Return/MyOrderReturns";

const OrderDetail = ({ id }: { id: string }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";
  const fallbackCurrency = useCurrency();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data: order, isLoading, isError } = useMyOrderQuery(id);

  const cancelMutation = useMutation({
    mutationFn: cancelMyOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MY_ORDERS_QUERY_KEY] });
      setConfirmOpen(false);
      toast.success(t("orderCancelled"));
    },
    onError: (error: any) => {
      // Most likely the store confirmed it in the meantime — show the new state.
      queryClient.invalidateQueries({ queryKey: [MY_ORDERS_QUERY_KEY] });
      setConfirmOpen(false);
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong"));
    },
  });

  if (isLoading) {
    return (
      <Stack alignItems="center" py={8}>
        <CircularProgress />
      </Stack>
    );
  }

  if (isError || !order) {
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
        <Typography color="text.secondary" mb={2}>
          {t("orderNotFound")}
        </Typography>
        <CustomLink href="/account/orders">
          <Button>{t("myOrders")}</Button>
        </CustomLink>
      </Paper>
    );
  }

  const currency = localized(order.currency, lang) || fallbackCurrency;

  return (
    <Stack spacing={3}>
      {justPlaced && order.status === "pending" && (
        <Alert severity="success" variant="filled" sx={{ borderRadius: 3 }}>
          <Typography fontWeight={700}>{t("orderPlacedTitle")}</Typography>
          {t("orderPlacedBody", { number: order.orderNumber })}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
        <CustomLink href="/account/orders" style={{ textDecoration: "none" }}>
          <Button size="small" startIcon={<ArrowBack sx={{ transform: lang === "ar" ? "scaleX(-1)" : undefined }} />} sx={{ mb: 1.5, ml: -1 }}>
            {t("myOrders")}
          </Button>
        </CustomLink>

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} mb={3}>
          <Stack>
            <Typography variant="h6" fontWeight={700}>
              {t("orderNumber", { number: order.orderNumber })}
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
          discount={order.discount}
          couponCode={order.coupon?.code}
          shippingFee={order.shippingFee}
          total={order.total}
          currency={currency}
        />
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, flex: 1 }}>
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

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={2}>
            {t("orderProgress")}
          </Typography>
          <StatusTimeline history={order.statusHistory ?? []} />
        </Paper>
      </Stack>

      {order.status === "delivered" && <MyOrderReturns orderId={order._id} currency={currency} />}

      {order.status === "pending" && (
        <Stack direction="row" justifyContent="flex-end">
          <Button color="error" variant="outlined" onClick={() => setConfirmOpen(true)}>
            {t("cancelOrder")}
          </Button>
        </Stack>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("cancelOrderConfirm")}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 1 }}
            label={t("cancelReasonOptional")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t("keepOrder")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate({ id: order._id, reason: reason.trim() || undefined })}
          >
            {t("cancelOrder")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

const MyOrderPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return (
    <Suspense>
      <OrderDetail id={id} />
    </Suspense>
  );
};

export default MyOrderPage;
