"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { COUPONS_QUERY_KEY } from "@/backend-api/coupons/hooks";
import { createCoupon, updateCoupon } from "@/backend-api/coupons/mutations";
import { Coupon, CouponPayload, CouponType } from "@/backend-api/coupons/types";
import { useCurrency } from "@/Hooks/useCurrency";

type FormState = {
  code: string;
  description: string;
  type: CouponType;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  description: "",
  type: "percentage",
  value: "",
  minSubtotal: "",
  maxDiscount: "",
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
  perCustomerLimit: "",
  isActive: true,
};

/** yyyy-mm-dd in local time, for <input type="date">. */
const toDateInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fromCoupon = (c: Coupon): FormState => ({
  code: c.code,
  description: c.description ?? "",
  type: c.type,
  value: String(c.value),
  minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : "",
  maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
  startsAt: toDateInput(c.startsAt),
  expiresAt: toDateInput(c.expiresAt),
  usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
  perCustomerLimit: c.perCustomerLimit != null ? String(c.perCustomerLimit) : "",
  isActive: c.isActive,
});

// Empty fields are sent as null so an edit can clear a limit that was set.
const optionalNumber = (v: string) => (v.trim() === "" ? null : Number(v));

const toPayload = (f: FormState): CouponPayload => ({
  code: f.code.trim().toUpperCase(),
  description: f.description.trim() || undefined,
  type: f.type,
  value: Number(f.value),
  minSubtotal: optionalNumber(f.minSubtotal),
  maxDiscount: f.type === "percentage" ? optionalNumber(f.maxDiscount) : null,
  // A start date counts from the beginning of that day, an end date through its end.
  startsAt: f.startsAt ? new Date(`${f.startsAt}T00:00:00`).toISOString() : null,
  expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : null,
  usageLimit: optionalNumber(f.usageLimit),
  perCustomerLimit: optionalNumber(f.perCustomerLimit),
  isActive: f.isActive,
});

const CouponFormDialog = ({
  open,
  coupon,
  onClose,
}: {
  open: boolean;
  /** The coupon being edited, or null to create one. */
  coupon: Coupon | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  // Mounted fresh each time it opens (see the coupons page), so this is the reset.
  const [form, setForm] = useState<FormState>(() => (coupon ? fromCoupon(coupon) : EMPTY));
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: (payload: CouponPayload) =>
      coupon ? updateCoupon({ id: coupon._id, data: payload }) : createCoupon(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COUPONS_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
    },
  });

  const value = Number(form.value);
  const errors = {
    code: !/^[A-Za-z0-9_-]+$/.test(form.code.trim()) ? t("couponCodeRule") : "",
    value:
      !form.value || !(value > 0)
        ? t("required")
        : form.type === "percentage" && value > 100
          ? t("percentMax")
          : "",
    dates:
      form.startsAt && form.expiresAt && form.expiresAt < form.startsAt ? t("expiryBeforeStart") : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    mutation.mutate(toPayload(form));
  };

  const show = (key: keyof typeof errors) => (submitted ? errors[key] : "");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{coupon ? t("editCoupon") : t("addCoupon")}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label={t("couponCode")}
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                error={!!show("code")}
                helperText={show("code") || t("couponCodeHint")}
                slotProps={{ htmlInput: { maxLength: 50, dir: "ltr" } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />}
                label={t("active")}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                label={t("descriptionOptional")}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t("discountType")}
                value={form.type}
                onChange={(e) => set("type", e.target.value as CouponType)}
              >
                <MenuItem value="percentage">{t("couponType.percentage")}</MenuItem>
                <MenuItem value="fixed">{t("couponType.fixed")}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("discountValue")}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                error={!!show("value")}
                helperText={show("value")}
                slotProps={{
                  htmlInput: { min: 0, step: "any" },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">{form.type === "percentage" ? "%" : currency}</InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("minOrderOptional")}
                value={form.minSubtotal}
                onChange={(e) => set("minSubtotal", e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
              />
            </Grid>
            {form.type === "percentage" && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t("maxDiscountOptional")}
                  value={form.maxDiscount}
                  onChange={(e) => set("maxDiscount", e.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: "any" } }}
                />
              </Grid>
            )}

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label={t("startsOn")}
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label={t("expiresOn")}
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
                error={!!show("dates")}
                helperText={show("dates")}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("usageLimitOptional")}
                value={form.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value)}
                helperText={t("usageLimitHint")}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("perCustomerLimitOptional")}
                value={form.perCustomerLimit}
                onChange={(e) => set("perCustomerLimit", e.target.value)}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {t("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CouponFormDialog;
