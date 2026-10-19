"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { clearCart, setCouponCode } from "@/Store/slices/cart";
import { useCustomerAddressesQuery } from "@/backend-api/customers/hooks";
import { Address } from "@/backend-api/customers/types";
import { DELIVERY_AREAS_QUERY_KEY } from "@/backend-api/price-list/hooks";
import { MY_ORDERS_QUERY_KEY, QUOTE_QUERY_KEY, useQuoteQuery } from "@/backend-api/orders/hooks";
import { placeGuestOrder, placeOrder } from "@/backend-api/orders/mutations";
import { CreateGuestOrderPayload } from "@/backend-api/orders/types";
import { useCurrency } from "@/Hooks/useCurrency";
import AddressFormDialog from "@/features/Customer/AddressFormDialog";
import OrderLines from "@/features/Order/OrderLines";
import { formatAddress, localized } from "@/features/Order/format";
import GuestDetails, { EMPTY_GUEST_DETAILS, GuestDetailsValues } from "@/features/Checkout/GuestDetails";

const CheckoutPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const fallbackCurrency = useCurrency();

  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.customer);
  const { items, couponCode, hydrated } = useAppSelector((state) => state.cart);

  const [pickedAddressId, setAddressId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // The saved address being edited from here, or null when adding one.
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  // Set once the order goes through, so emptying the cart doesn't bounce the
  // shopper back to /cart on the way to their confirmation page.
  const placed = useRef(false);

  const inputs = useMemo(
    () => items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    [items]
  );
  const { data: addresses, isLoading: addressesLoading } = useCustomerAddressesQuery();
  const guestForm = useForm<GuestDetailsValues>({ defaultValues: EMPTY_GUEST_DETAILS });
  const guestSubZoneId = useWatch({ control: guestForm.control, name: "subZoneId" });

  useEffect(() => {
    if (hydrated && items.length === 0 && !placed.current) router.replace(`/${lang}/cart`);
  }, [hydrated, items.length, lang, router]);

  // The shopper's pick while it still exists, otherwise the default address.
  const addressId = addresses?.some((a) => a._id === pickedAddressId)
    ? pickedAddressId
    : ((addresses?.find((a) => a.isDefault) ?? addresses?.[0])?._id ?? "");
  const selectedAddress = addresses?.find((a) => a._id === addressId);

  // Delivery is priced from the area being shipped to.
  const subZoneId = isLoggedIn ? selectedAddress?.subZone : guestSubZoneId || undefined;
  const { data: quote, isLoading: quoteLoading } = useQuoteQuery(inputs, couponCode, subZoneId);
  /** A saved address from before the price list has no area to price. */
  const addressNeedsArea = isLoggedIn && !!selectedAddress && !selectedAddress.subZone;

  const currency = localized(quote?.currency, lang) || fallbackCurrency;

  const onPlaced = (href: string) => {
    placed.current = true;
    dispatch(clearCart());
    router.replace(href);
  };

  const onOrderError = (error: any) => {
      const data = error?.response?.data;
      // The store stopped delivering to the chosen area — refresh the pickers.
      if (data?.code === "delivery_unavailable") {
        queryClient.invalidateQueries({ queryKey: [QUOTE_QUERY_KEY] });
        queryClient.invalidateQueries({ queryKey: [DELIVERY_AREAS_QUERY_KEY] });
        toast.error(t("deliveryUnavailable"));
        return;
      }
      // The coupon stopped applying (used up, or a per-customer limit) — re-price
      // here; the summary explains it and offers to drop the code.
      if (data?.couponError) {
        queryClient.invalidateQueries({ queryKey: [QUOTE_QUERY_KEY] });
        toast.error(t(`couponError.${data.couponError.code}`));
        return;
      }
      // Stock or prices moved under the shopper — re-price and send them to
      // the cart, where each problem line is explained.
      if (data?.issues || error?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: [QUOTE_QUERY_KEY] });
        toast.error(data?.message ?? t("cartHasIssues"));
        router.push(`/${lang}/cart`);
        return;
      }
      toast.error(Array.isArray(data?.message) ? data.message[0] : data?.message ?? t("somethingWentWrong"));
  };

  const orderMutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: [MY_ORDERS_QUERY_KEY] });
      onPlaced(`/${lang}/account/orders/${order._id}?placed=1`);
    },
    onError: onOrderError,
  });

  // The confirmation opens by the order's token — no session needed.
  const guestMutation = useMutation({
    mutationFn: placeGuestOrder,
    onSuccess: ({ order, token }) =>
      onPlaced(`/${lang}/orders/${order._id}?token=${encodeURIComponent(token)}&placed=1`),
    onError: onOrderError,
  });

  const isPending = orderMutation.isPending || guestMutation.isPending;

  const submitGuest = guestForm.handleSubmit(({ email, ...address }) => {
    const optional = (value: string) => value.trim() || undefined;
    const payload: CreateGuestOrderPayload = {
      items: inputs,
      email: email.trim(),
      shippingAddress: {
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        subZoneId: address.subZoneId,
        area: optional(address.area),
        street: address.street.trim(),
        building: optional(address.building),
        notes: optional(address.notes),
      },
      paymentMethod: "cash_on_delivery",
      notes: notes.trim() || undefined,
      couponCode: quote?.coupon?.code,
      locale: lang,
    };
    guestMutation.mutate(payload);
  });

  const submit = () => {
    if (!isLoggedIn) {
      submitGuest();
      return;
    }
    if (!addressId) {
      toast.error(t("chooseAddress"));
      return;
    }
    orderMutation.mutate({
      items: inputs,
      addressId,
      paymentMethod: "cash_on_delivery",
      notes: notes.trim() || undefined,
      // Only a code the quote accepted; a refused one is ignored, not sent.
      couponCode: quote?.coupon?.code,
      locale: lang,
    });
  };

  if (!isInitialized || !hydrated || items.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="50vh">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t("checkout")}
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Stack spacing={3} flex={1} width="100%">
          {!isLoggedIn ? (
            <GuestDetails control={guestForm.control} />
          ) : (
            // Signed in: pick one of the saved addresses.
            <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("deliveryAddress")}
                </Typography>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => {
                    setEditingAddress(null);
                    setDialogOpen(true);
                  }}
                >
                  {t("addAddress")}
                </Button>
              </Stack>

              {addressesLoading ? (
                <CircularProgress size={24} />
              ) : !addresses?.length ? (
                <Alert severity="info">{t("addAddressToContinue")}</Alert>
              ) : (
                <RadioGroup value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                  <Stack spacing={1.5}>
                    {addresses.map((address) => (
                      <Paper
                        key={address._id}
                        variant="outlined"
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          borderColor: address._id === addressId ? "primary.main" : "divider",
                          borderWidth: address._id === addressId ? 2 : 1,
                        }}
                      >
                        <FormControlLabel
                          value={address._id}
                          control={<Radio />}
                          sx={{ width: "100%", m: 0, alignItems: "flex-start", "& .MuiRadio-root": { mt: 0.25 } }}
                          label={
                            <Box py={1}>
                              <Typography variant="body2" fontWeight={600}>
                                {address.label ? `${address.label} · ` : ""}
                                {address.fullName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatAddress(address, lang)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" dir="ltr" sx={{ textAlign: "start" }}>
                                {address.phone}
                              </Typography>
                            </Box>
                          }
                        />
                      </Paper>
                    ))}
                  </Stack>
                </RadioGroup>
              )}

              {addressNeedsArea && (
                <Alert
                  severity="warning"
                  sx={{ mt: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        setEditingAddress(selectedAddress ?? null);
                        setDialogOpen(true);
                      }}
                    >
                      {t("edit")}
                    </Button>
                  }
                >
                  {t("addressNeedsArea")}
                </Alert>
              )}
            </Paper>
          )}

          {/* Payment */}
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              {t("paymentMethod")}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LocalShippingOutlined color="primary" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {t("paymentMethods.cash_on_delivery")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("cashOnDeliveryHint")}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Notes */}
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              {t("orderNotes")}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              placeholder={t("orderNotesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Paper>
        </Stack>

        {/* Summary */}
        <Paper
          variant="outlined"
          sx={{ p: 3, borderRadius: 3, width: { xs: "100%", md: 380 }, flexShrink: 0, position: { md: "sticky" }, top: { md: 96 } }}
        >
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("orderSummary")}
          </Typography>

          {quoteLoading || !quote ? (
            <Stack alignItems="center" py={3}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Stack spacing={2}>
              <OrderLines
                lines={quote.items.map((line) => ({
                  key: `${line.productId}:${line.variantId ?? ""}`,
                  ...line,
                }))}
                subtotal={quote.subtotal}
                discount={quote.discount}
                couponCode={quote.coupon?.code}
                shippingFee={quote.shippingFee}
                shippingPending={quote.delivery === "pending"}
                total={quote.total}
                currency={currency}
              />

              {quote.delivery === "unavailable" && (
                <Alert severity="warning">{t("deliveryUnavailable")}</Alert>
              )}

              {couponCode && quote.couponError && (
                <Alert
                  severity="warning"
                  action={
                    <Button color="inherit" size="small" onClick={() => dispatch(setCouponCode(undefined))}>
                      {t("remove")}
                    </Button>
                  }
                >
                  {quote.couponError.code === "min_subtotal" && quote.couponError.minSubtotal != null
                    ? t("couponError.min_subtotal", { amount: `${quote.couponError.minSubtotal.toLocaleString()} ${currency}` })
                    : t(`couponError.${quote.couponError.code}`)}
                </Alert>
              )}

              {!quote.valid && (
                <Alert
                  severity="warning"
                  action={
                    <Button color="inherit" size="small" onClick={() => router.push(`/${lang}/cart`)}>
                      {t("reviewCart")}
                    </Button>
                  }
                >
                  {t("cartHasIssues")}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                onClick={submit}
                disabled={
                  !quote.valid ||
                  (isLoggedIn && (!addressId || addressNeedsArea)) ||
                  quote.delivery === "unavailable" ||
                  isPending
                }
                sx={{ borderRadius: 2 }}
              >
                {isPending ? <CircularProgress size={24} color="inherit" /> : t("placeOrder")}
              </Button>
            </Stack>
          )}
        </Paper>
      </Stack>

      {isLoggedIn && (
        <AddressFormDialog open={dialogOpen} address={editingAddress} onClose={() => setDialogOpen(false)} />
      )}
    </Container>
  );
};

export default CheckoutPage;
