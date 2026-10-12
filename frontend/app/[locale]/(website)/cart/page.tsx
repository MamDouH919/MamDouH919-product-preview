"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { CartItem, removeFromCart, setCartQuantity } from "@/Store/slices/cart";
import { useQuoteQuery } from "@/backend-api/orders/hooks";
import { QuoteLine } from "@/backend-api/orders/types";
import { getBackendUri } from "@/utils/helperFunctions";
import { useCurrency } from "@/Hooks/useCurrency";
import CustomLink from "@/components/CustomLink";
import { formatMoney, localized } from "@/features/Order/format";

const lineKey = (l: { productId: string; variantId?: string }) => `${l.productId}:${l.variantId ?? ""}`;

const CartPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { items, hydrated } = useAppSelector((state) => state.cart);
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);
  const fallbackCurrency = useCurrency();

  const inputs = useMemo(
    () => items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    [items]
  );
  const { data: quote, isLoading, isError } = useQuoteQuery(inputs);

  const quoteByKey = useMemo(
    () => new Map((quote?.items ?? []).map((line) => [lineKey(line), line])),
    [quote]
  );
  const currency = localized(quote?.currency, lang) || fallbackCurrency;

  const goToCheckout = () => {
    const checkout = `/${lang}/checkout`;
    router.push(isLoggedIn ? checkout : `/${lang}/account/login?from=${encodeURIComponent(checkout)}`);
  };

  if (!hydrated) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="50vh">
        <CircularProgress />
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
        <ShoppingBagOutlined sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" fontWeight={700} mb={1}>
          {t("cartEmpty")}
        </Typography>
        <Typography color="text.secondary" mb={3}>
          {t("cartEmptyHint")}
        </Typography>
        <CustomLink href="/products">
          <Button variant="contained">{t("browseProducts")}</Button>
        </CustomLink>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t("cart")}
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Stack spacing={2} flex={1} width="100%">
          {items.map((item) => (
            <CartRow
              key={lineKey(item)}
              item={item}
              line={quoteByKey.get(lineKey(item))}
              currency={currency}
              lang={lang}
              onQuantity={(quantity) =>
                dispatch(setCartQuantity({ productId: item.productId, variantId: item.variantId, quantity }))
              }
              onRemove={() =>
                dispatch(removeFromCart({ productId: item.productId, variantId: item.variantId }))
              }
            />
          ))}
        </Stack>

        <Paper
          variant="outlined"
          sx={{ p: 3, borderRadius: 3, width: { xs: "100%", md: 340 }, flexShrink: 0, position: { md: "sticky" }, top: { md: 96 } }}
        >
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("orderSummary")}
          </Typography>

          {isError ? (
            <Alert severity="error">{t("somethingWentWrong")}</Alert>
          ) : isLoading || !quote ? (
            <Stack alignItems="center" py={3}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Stack spacing={1.25}>
              <SummaryRow label={t("subtotal")} value={formatMoney(quote.subtotal, currency)} />
              <SummaryRow
                label={t("delivery")}
                value={quote.shippingFee > 0 ? formatMoney(quote.shippingFee, currency) : t("free")}
              />
              <SummaryRow label={t("total")} value={formatMoney(quote.total, currency)} strong />

              {!quote.valid && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t("cartHasIssues")}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                onClick={goToCheckout}
                disabled={!quote.valid}
                sx={{ mt: 1.5, borderRadius: 2 }}
              >
                {t("checkout")}
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                {t("cashOnDeliveryHint")}
              </Typography>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Container>
  );
};

const CartRow = ({
  item,
  line,
  currency,
  lang,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  line?: QuoteLine;
  currency: string;
  lang: string;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) => {
  const { t } = useTranslation();

  // Prefer the live price; the snapshot only fills in while the quote loads.
  const unitPrice = line?.unitPrice ?? item.price;
  const max = line?.available ?? 999;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <CustomLink href={`/products/${item.slug}`}>
          <Box
            sx={{
              position: "relative",
              width: 80,
              height: 80,
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "grey.100",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.image ? (
              <Image src={getBackendUri(item.image)} alt="" fill style={{ objectFit: "cover" }} unoptimized />
            ) : (
              <ShoppingBagOutlined color="disabled" />
            )}
          </Box>
        </CustomLink>

        <Box flex={1} minWidth={0}>
          <CustomLink href={`/products/${item.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
            <Typography fontWeight={600} noWrap>
              {localized(line?.name ?? item.name, lang)}
            </Typography>
          </CustomLink>
          {item.variantLabel && (
            <Typography variant="caption" color="text.secondary" display="block">
              {item.variantLabel}
            </Typography>
          )}
          {unitPrice != null && (
            <Typography variant="body2" color="primary" fontWeight={600}>
              {formatMoney(unitPrice, currency)}
            </Typography>
          )}

          <Stack direction="row" alignItems="center" spacing={1} mt={1}>
            <Stack direction="row" alignItems="center" sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
              <IconButton size="small" onClick={() => onQuantity(item.quantity - 1)} aria-label={t("decrease")}>
                <Remove fontSize="small" />
              </IconButton>
              <Typography width={32} textAlign="center" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
                {item.quantity}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onQuantity(item.quantity + 1)}
                disabled={item.quantity >= Math.min(max, 999)}
                aria-label={t("increase")}
              >
                <Add fontSize="small" />
              </IconButton>
            </Stack>
            <IconButton size="small" color="error" onClick={onRemove} aria-label={t("remove")}>
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Typography fontWeight={700} whiteSpace="nowrap" sx={{ alignSelf: "flex-start" }}>
          {line ? formatMoney(line.lineTotal, currency) : ""}
        </Typography>
      </Stack>

      {line?.issue && (
        <Alert
          severity={line.issue === "insufficient_stock" ? "warning" : "error"}
          sx={{ mt: 1.5 }}
          action={
            line.issue === "insufficient_stock" && (line.available ?? 0) > 0 ? (
              <Button color="inherit" size="small" onClick={() => onQuantity(line.available!)}>
                {t("useAvailable", { count: line.available! })}
              </Button>
            ) : (
              <Button color="inherit" size="small" onClick={onRemove}>
                {t("remove")}
              </Button>
            )
          }
        >
          {line.issue === "insufficient_stock"
            ? (line.available ?? 0) > 0
              ? t("onlyNAvailable", { count: line.available! })
              : t("outOfStock")
            : t("noLongerAvailable")}
        </Alert>
      )}
    </Paper>
  );
};

const SummaryRow = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant={strong ? "subtitle1" : "body2"} fontWeight={strong ? 700 : 400} color={strong ? "text.primary" : "text.secondary"}>
      {label}
    </Typography>
    <Typography variant={strong ? "subtitle1" : "body2"} fontWeight={strong ? 700 : 500}>
      {value}
    </Typography>
  </Stack>
);

export default CartPage;
