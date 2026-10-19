"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import { trackOrder } from "@/backend-api/orders/mutations";
import { TrackedOrder } from "@/backend-api/orders/types";
import { useAppSelector } from "@/Store/store";
import { useCurrency } from "@/Hooks/useCurrency";
import CustomLink from "@/components/CustomLink";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import OrderLines from "@/features/Order/OrderLines";
import StatusTimeline from "@/features/Order/StatusTimeline";
import { formatDateTime, localized } from "@/features/Order/format";

const TrackedOrderView = ({ order, onReset }: { order: TrackedOrder; onReset: () => void }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fallbackCurrency = useCurrency();
  const currency = localized(order.currency, lang) || fallbackCurrency;
  const area = [localized(order.delivery.subZoneName, lang), localized(order.delivery.zoneName, lang) || order.delivery.city]
    .filter(Boolean)
    .join(lang === "ar" ? "، " : ", ");

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
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
          shippingFee={order.shippingFee}
          total={order.total}
          currency={currency}
        />
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
            {t("deliveringTo")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {[order.recipient, area].filter(Boolean).join(" — ")}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
            {t("paymentMethod")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`paymentMethods.${order.paymentMethod}`)}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={2}>
            {t("orderProgress")}
          </Typography>
          <StatusTimeline history={order.statusHistory ?? []} />
        </Paper>
      </Stack>

      <Button onClick={onReset} sx={{ alignSelf: "flex-start" }}>
        {t("trackAnotherOrder")}
      </Button>
    </Stack>
  );
};

const TrackOrderForm = () => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  const [orderNumber, setOrderNumber] = useState(searchParams.get("number") ?? "");
  const [contact, setContact] = useState("");

  const mutation = useMutation({ mutationFn: trackOrder });
  const status = mutation.error ? (mutation.error as any)?.response?.status : undefined;

  if (mutation.data) {
    return <TrackedOrderView order={mutation.data} onReset={() => mutation.reset()} />;
  }

  const number = Number(orderNumber.replace(/\D/g, ""));
  const canSubmit = number > 0 && contact.trim().length >= 5 && !mutation.isPending;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, maxWidth: 520, mx: "auto" }}>
      <Stack
        component="form"
        spacing={2.5}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate({ orderNumber: number, contact: contact.trim() });
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <LocalShippingOutlined color="primary" />
          <Typography variant="h6" fontWeight={700}>
            {t("trackYourOrder")}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t("trackOrderHint")}
        </Typography>

        {mutation.isError && (
          <Alert severity={status === 429 ? "warning" : "error"}>
            {status === 404 ? t("trackOrderNotFound") : status === 429 ? t("tooManyAttempts") : t("somethingWentWrong")}
          </Alert>
        )}

        <TextField
          label={t("orderNumberLabel")}
          placeholder="1042"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          slotProps={{ htmlInput: { inputMode: "numeric", dir: "ltr" } }}
          required
          fullWidth
        />
        <TextField
          label={t("emailOrPhone")}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          helperText={t("emailOrPhoneHint")}
          slotProps={{ htmlInput: { dir: "ltr", autoComplete: "email" } }}
          required
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={!canSubmit}>
          {t("trackOrder")}
        </Button>

        {isLoggedIn && (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            <CustomLink href="/account/orders" className="underline underline-offset-4">
              {t("seeAllYourOrders")}
            </CustomLink>
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

/** Order status without signing in: order number plus the email or phone used at checkout. */
const TrackOrderClient = () => (
  <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
    <Suspense>
      <TrackOrderForm />
    </Suspense>
  </Container>
);

export default TrackOrderClient;
