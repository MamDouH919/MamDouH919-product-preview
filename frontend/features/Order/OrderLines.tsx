"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Box, Divider, Stack, Typography } from "@mui/material";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri } from "@/utils/helperFunctions";
import { formatMoney, localized } from "./format";

export type OrderLine = {
  key: string;
  name?: LocalizedField;
  variantLabel?: string;
  image?: string;
  unitPrice?: number;
  quantity: number;
  lineTotal: number;
};

/** A read-only list of lines with subtotal, delivery and total underneath. */
const OrderLines = ({
  lines,
  subtotal,
  discount = 0,
  couponCode,
  shippingFee,
  shippingPending = false,
  total,
  currency,
}: {
  lines: OrderLine[];
  subtotal: number;
  discount?: number;
  couponCode?: string;
  shippingFee: number;
  /** No delivery area chosen yet, so the fee isn't known. */
  shippingPending?: boolean;
  total: number;
  currency: string;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <Stack spacing={2}>
      {lines.map((line) => (
        <Stack key={line.key} direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              position: "relative",
              width: 56,
              height: 56,
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "grey.100",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {line.image ? (
              <Image src={getBackendUri(line.image)} alt="" fill style={{ objectFit: "cover" }} unoptimized />
            ) : (
              <ShoppingBagOutlined color="disabled" />
            )}
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {localized(line.name, lang)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {line.variantLabel ? `${line.variantLabel} · ` : ""}
              {line.quantity} × {line.unitPrice != null ? formatMoney(line.unitPrice, currency) : "—"}
            </Typography>
          </Box>
          <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
            {formatMoney(line.lineTotal, currency)}
          </Typography>
        </Stack>
      ))}

      <Divider />

      <Stack spacing={1}>
        <Row label={t("subtotal")} value={formatMoney(subtotal, currency)} />
        {discount > 0 && (
          <Row
            label={couponCode ? `${t("discount")} (${couponCode})` : t("discount")}
            value={`− ${formatMoney(discount, currency)}`}
            accent
          />
        )}
        <Row
          label={t("delivery")}
          value={
            shippingPending
              ? t("chooseAreaForDelivery")
              : shippingFee > 0
                ? formatMoney(shippingFee, currency)
                : t("free")
          }
        />
        <Row label={t("total")} value={formatMoney(total, currency)} strong />
      </Stack>
    </Stack>
  );
};

const Row = ({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) => (
  <Stack direction="row" justifyContent="space-between">
    <Typography variant={strong ? "subtitle1" : "body2"} fontWeight={strong ? 700 : 400} color={strong ? "text.primary" : "text.secondary"}>
      {label}
    </Typography>
    <Typography
      variant={strong ? "subtitle1" : "body2"}
      fontWeight={strong ? 700 : 500}
      color={accent ? "success.main" : undefined}
      whiteSpace="nowrap"
    >
      {value}
    </Typography>
  </Stack>
);

export default OrderLines;
