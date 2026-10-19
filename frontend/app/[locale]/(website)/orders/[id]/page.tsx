"use client";

import { Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PersonAddAlt1Outlined from "@mui/icons-material/PersonAddAlt1Outlined";
import { GUEST_ORDER_QUERY_KEY, useGuestOrderQuery } from "@/backend-api/orders/hooks";
import { claimGuestAccount } from "@/backend-api/orders/mutations";
import { GuestOrder } from "@/backend-api/orders/types";
import { setCustomerTokenInCookie } from "@/actions/cookies";
import { setCustomerAuthToken } from "@/lib/customerApi";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { setCustomer } from "@/Store/slices/customer";
import { useCurrency } from "@/Hooks/useCurrency";
import CustomLink from "@/components/CustomLink";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import OrderLines from "@/features/Order/OrderLines";
import ShippingAddressBlock from "@/features/Order/ShippingAddressBlock";
import StatusTimeline from "@/features/Order/StatusTimeline";
import { formatDateTime, localized } from "@/features/Order/format";

type PasswordValues = { password: string; confirmPassword: string };

/**
 * Turning the guest checkout into an account, the way Shopify's thank-you page
 * does. What's on offer depends on the customer record behind the email.
 */
const CreateAccountPanel = ({ order, token }: { order: GuestOrder; token: string }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  const { control, handleSubmit } = useForm<PasswordValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: claimGuestAccount,
    onSuccess: async ({ session, activationSent }) => {
      if (session) {
        await setCustomerTokenInCookie(session.accessToken);
        setCustomerAuthToken(session.accessToken);
        dispatch(setCustomer(session.customer));
        toast.success(t("accountCreated"));
        router.replace(`/${lang}/account/orders/${order._id}`);
        return;
      }
      if (activationSent) toast.success(t("activationLinkSent"));
    },
    onError: (error: any) => {
      // The account got activated some other way meanwhile — show the new state.
      queryClient.invalidateQueries({ queryKey: [GUEST_ORDER_QUERY_KEY] });
      const message = error?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
    },
  });

  if (isLoggedIn) return null;

  const from = encodeURIComponent(`/${lang}/account/orders/${order._id}`);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
        <PersonAddAlt1Outlined color="primary" />
        <Typography variant="subtitle1" fontWeight={700}>
          {order.account === "registered" ? t("youHaveAnAccount") : t("saveInfoForNextTime")}
        </Typography>
      </Stack>

      {order.account === "registered" && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t("orderAddedToAccount")}
          </Typography>
          <CustomLink href={`/account/login?from=${from}`}>
            <Button variant="contained">{t("signIn")}</Button>
          </CustomLink>
        </Stack>
      )}

      {order.account === "claimable" && (
        <form onSubmit={handleSubmit(({ password }) => mutation.mutate({ id: order._id, token, password }))}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t("setPasswordToCreateAccount")}
            </Typography>
            <TextInputComponent
              name="password"
              label={t("password")}
              control={control}
              type="password"
              required
              rules={{
                required: true,
                minLength: { value: 6, message: t("passwordTooShort") },
                deps: ["confirmPassword"],
              }}
            />
            <TextInputComponent
              name="confirmPassword"
              label={t("confirmPassword")}
              control={control}
              type="password"
              required
              rules={{
                required: true,
                validate: (value: string, values: PasswordValues) =>
                  value === values.password || t("passwordsDoNotMatch"),
              }}
            />
            <Button type="submit" variant="contained" disabled={mutation.isPending} sx={{ alignSelf: "flex-start" }}>
              {t("createAccount")}
            </Button>
          </Stack>
        </form>
      )}

      {order.account === "guest" && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t("activateByEmailHint")}
          </Typography>
          <Button
            variant="contained"
            disabled={mutation.isPending || mutation.isSuccess}
            onClick={() => mutation.mutate({ id: order._id, token })}
            sx={{ alignSelf: "flex-start" }}
          >
            {mutation.isSuccess ? t("activationLinkSent") : t("sendActivationLink")}
          </Button>
        </Stack>
      )}
    </Paper>
  );
};

const GuestOrderDetail = ({ id }: { id: string }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const justPlaced = searchParams.get("placed") === "1";
  const fallbackCurrency = useCurrency();

  const { data: order, isLoading, isError } = useGuestOrderQuery(id, token);

  if (isLoading) {
    return (
      <Stack alignItems="center" py={8}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!token || isError || !order) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
          <Typography color="text.secondary" mb={2}>
            {t("orderNotFound")}
          </Typography>
          <CustomLink href="/account/login">
            <Button>{t("signIn")}</Button>
          </CustomLink>
        </Paper>
      </Container>
    );
  }

  const currency = localized(order.currency, lang) || fallbackCurrency;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        {justPlaced && order.status === "pending" && (
          <Alert severity="success" variant="filled" sx={{ borderRadius: 3 }}>
            <Typography fontWeight={700}>{t("orderPlacedTitle")}</Typography>
            {t("orderPlacedBody", { number: order.orderNumber })} {t("confirmationEmailSent")}
          </Alert>
        )}

        <CreateAccountPanel order={order} token={token} />

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
      </Stack>
    </Container>
  );
};

/** A guest's order, opened by the token in its confirmation link. */
const GuestOrderPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return (
    <Suspense>
      <GuestOrderDetail id={id} />
    </Suspense>
  );
};

export default GuestOrderPage;
