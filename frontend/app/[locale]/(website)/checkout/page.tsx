"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { clearCart } from "@/Store/slices/cart";
import { useCustomerAddressesQuery } from "@/backend-api/customers/hooks";
import { MY_ORDERS_QUERY_KEY, QUOTE_QUERY_KEY, useQuoteQuery } from "@/backend-api/orders/hooks";
import { placeOrder } from "@/backend-api/orders/mutations";
import { useCurrency } from "@/Hooks/useCurrency";
import AddressFormDialog from "@/features/Customer/AddressFormDialog";
import OrderLines from "@/features/Order/OrderLines";
import { localized } from "@/features/Order/format";

const CheckoutPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const fallbackCurrency = useCurrency();

  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.customer);
  const { items, hydrated } = useAppSelector((state) => state.cart);

  const [pickedAddressId, setAddressId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Set once the order goes through, so emptying the cart doesn't bounce the
  // shopper back to /cart on the way to their confirmation page.
  const placed = useRef(false);

  const inputs = useMemo(
    () => items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    [items]
  );
  const { data: quote, isLoading: quoteLoading } = useQuoteQuery(inputs);
  const { data: addresses, isLoading: addressesLoading } = useCustomerAddressesQuery();

  const currency = localized(quote?.currency, lang) || fallbackCurrency;

  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      const here = `/${lang}/checkout`;
      router.replace(`/${lang}/account/login?from=${encodeURIComponent(here)}`);
    }
  }, [isInitialized, isLoggedIn, lang, router]);

  useEffect(() => {
    if (hydrated && items.length === 0 && !placed.current) router.replace(`/${lang}/cart`);
  }, [hydrated, items.length, lang, router]);

  // The shopper's pick while it still exists, otherwise the default address.
  const addressId = addresses?.some((a) => a._id === pickedAddressId)
    ? pickedAddressId
    : ((addresses?.find((a) => a.isDefault) ?? addresses?.[0])?._id ?? "");

  const orderMutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (order) => {
      placed.current = true;
      dispatch(clearCart());
      queryClient.invalidateQueries({ queryKey: [MY_ORDERS_QUERY_KEY] });
      router.replace(`/${lang}/account/orders/${order._id}?placed=1`);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      // Stock or prices moved under the shopper — re-price and send them to
      // the cart, where each problem line is explained.
      if (data?.issues || error?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: [QUOTE_QUERY_KEY] });
        toast.error(data?.message ?? t("cartHasIssues"));
        router.push(`/${lang}/cart`);
        return;
      }
      toast.error(Array.isArray(data?.message) ? data.message[0] : data?.message ?? t("somethingWentWrong"));
    },
  });

  const submit = () => {
    if (!addressId) {
      toast.error(t("chooseAddress"));
      return;
    }
    orderMutation.mutate({
      items: inputs,
      addressId,
      paymentMethod: "cash_on_delivery",
      notes: notes.trim() || undefined,
    });
  };

  if (!isInitialized || !isLoggedIn || !hydrated || items.length === 0) {
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
          {/* Address */}
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                {t("deliveryAddress")}
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
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
                              {[address.street, address.building, address.area, address.city]
                                .filter(Boolean)
                                .join(", ")}
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
          </Paper>

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
                shippingFee={quote.shippingFee}
                total={quote.total}
                currency={currency}
              />

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
                disabled={!quote.valid || !addressId || orderMutation.isPending}
                sx={{ borderRadius: 2 }}
              >
                {orderMutation.isPending ? <CircularProgress size={24} color="inherit" /> : t("placeOrder")}
              </Button>
            </Stack>
          )}
        </Paper>
      </Stack>

      <AddressFormDialog open={dialogOpen} address={null} onClose={() => setDialogOpen(false)} />
    </Container>
  );
};

export default CheckoutPage;
