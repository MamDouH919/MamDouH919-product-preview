"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { COUPONS_QUERY_KEY, useCouponsQuery } from "@/backend-api/coupons/hooks";
import { deleteCoupon } from "@/backend-api/coupons/mutations";
import { Coupon } from "@/backend-api/coupons/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import CouponFormDialog from "@/features/Coupon/CouponFormDialog";
import { formatMoney } from "@/features/Order/format";

/** Where a coupon stands right now, from its switch, dates and usage. */
const couponState = (c: Coupon): "active" | "inactive" | "scheduled" | "expired" | "used_up" => {
  const now = Date.now();
  if (!c.isActive) return "inactive";
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return "expired";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "used_up";
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return "scheduled";
  return "active";
};

const CouponsPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCouponsQuery(debounced);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("coupons") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COUPONS_QUERY_KEY] });
      setDeleting(null);
      toast.success(t("deletedSuccessfully"));
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  const columns = useMemo(() => {
    const date = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB") : "—";

    const stateColor = {
      active: "success",
      scheduled: "info",
      inactive: "default",
      expired: "default",
      used_up: "warning",
    } as const;

    return [
      {
        id: "code",
        header: t("couponCode"),
        render: (row: Coupon) => (
          <Stack>
            <Typography variant="body2" fontWeight={700} dir="ltr" sx={{ textAlign: "start" }}>
              {row.code}
            </Typography>
            {row.description && (
              <Typography variant="caption" color="text.secondary">
                {row.description}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        id: "discount",
        header: t("discount"),
        render: (row: Coupon) => (
          <Stack>
            <Typography variant="body2" fontWeight={600}>
              {row.type === "percentage" ? `${row.value}%` : formatMoney(row.value, currency)}
            </Typography>
            {(row.minSubtotal != null || row.maxDiscount != null) && (
              <Typography variant="caption" color="text.secondary">
                {[
                  row.minSubtotal != null ? `${t("min")} ${formatMoney(row.minSubtotal, currency)}` : "",
                  row.maxDiscount != null ? `${t("max")} ${formatMoney(row.maxDiscount, currency)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        id: "validity",
        header: t("validity"),
        render: (row: Coupon) =>
          row.startsAt || row.expiresAt ? `${date(row.startsAt)} → ${date(row.expiresAt)}` : t("noExpiry"),
      },
      {
        id: "usage",
        header: t("usage"),
        render: (row: Coupon) =>
          `${row.usedCount} / ${row.usageLimit ?? "∞"}` +
          (row.perCustomerLimit != null ? ` · ${t("perCustomerShort", { count: row.perCustomerLimit })}` : ""),
      },
      {
        id: "status",
        header: t("status"),
        render: (row: Coupon) => {
          const state = couponState(row);
          return <Chip size="small" color={stateColor[state]} label={t(`couponState.${state}`)} />;
        },
      },
      {
        id: "actions",
        header: "",
        render: (row: Coupon) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t("edit")}>
              <IconButton
                size="small"
                onClick={() => {
                  setEditing(row);
                  setFormOpen(true);
                }}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("delete")}>
              <IconButton size="small" color="error" onClick={() => setDeleting(row)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ];
  }, [t, lang, currency]);

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
        <TextField
          size="small"
          label={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          {t("addCoupon")}
        </Button>
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      {formOpen && <CouponFormDialog open coupon={editing} onClose={() => setFormOpen(false)} />}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("deleteCouponConfirm", { code: deleting?.code })}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("deleteCouponHint")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting._id)}
          >
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default CouponsPage;
