"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Chip, Stack, TextField } from "@mui/material";
import LocalOfferOutlined from "@mui/icons-material/LocalOfferOutlined";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { setCouponCode } from "@/Store/slices/cart";
import { Quote } from "@/backend-api/orders/types";
import { formatMoney } from "@/features/Order/format";

/**
 * Enter / remove a coupon. The code lives in the cart; whether it applies is
 * read from the quote, which the server re-prices with the code included.
 */
const CouponField = ({ quote, currency }: { quote?: Quote; currency: string }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const couponCode = useAppSelector((state) => state.cart.couponCode);
  const [input, setInput] = useState("");

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) dispatch(setCouponCode(input));
    setInput("");
  };

  if (couponCode) {
    const error = quote?.couponError;
    return (
      <Stack spacing={1}>
        <Chip
          icon={<LocalOfferOutlined />}
          label={couponCode}
          color={error ? "default" : "success"}
          variant={error ? "outlined" : "filled"}
          onDelete={() => dispatch(setCouponCode(undefined))}
          sx={{ alignSelf: "flex-start", fontWeight: 700 }}
        />
        {error && (
          <Alert severity="warning" sx={{ py: 0 }}>
            {error.code === "min_subtotal" && error.minSubtotal != null
              ? t("couponError.min_subtotal", { amount: formatMoney(error.minSubtotal, currency) })
              : t(`couponError.${error.code}`)}
          </Alert>
        )}
      </Stack>
    );
  }

  return (
    <Stack component="form" direction="row" spacing={1} onSubmit={apply}>
      <TextField
        size="small"
        fullWidth
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("couponCode")}
        slotProps={{ htmlInput: { maxLength: 50, dir: "ltr", style: { textTransform: "uppercase" } } }}
      />
      <Button type="submit" variant="outlined" disabled={!input.trim()}>
        {t("apply")}
      </Button>
    </Stack>
  );
};

export default CouponField;
