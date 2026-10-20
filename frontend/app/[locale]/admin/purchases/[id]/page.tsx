"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { PURCHASES_QUERY_KEY, SUPPLIERS_QUERY_KEY, usePurchaseQuery } from "@/backend-api/purchasing/hooks";
import { deletePurchase, postPurchase } from "@/backend-api/purchasing/mutations";
import { useCurrency } from "@/Hooks/useCurrency";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";
import PurchaseFormDialog from "@/features/Purchasing/PurchaseFormDialog";
import ReturnToSupplierDialog from "@/features/Purchasing/ReturnToSupplierDialog";
import PaySupplierDialog from "@/features/Purchasing/PaySupplierDialog";
import { toastError } from "@/features/Purchasing/shared";

/** One purchase: its lines at cost, and — once posted — what was returned, paid and is still owed. */
const PurchasePage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { data: purchase, isLoading } = usePurchaseQuery(id);
  const [editing, setEditing] = useState(0);
  const [confirmPost, setConfirmPost] = useState(false);
  const [returning, setReturning] = useState(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("purchases"), link: "/admin/purchases" },
          { title: purchase ? t("purchaseNumber", { number: purchase.purchaseNumber }) : t("purchase") },
        ],
        breadCrumbBtns: [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.purchaseNumber]);

  const refresh = () => {
    for (const key of [PURCHASES_QUERY_KEY, SUPPLIERS_QUERY_KEY, "inventory"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const post = useMutation({
    mutationFn: () => postPurchase(id),
    onSuccess: () => {
      refresh();
      setConfirmPost(false);
      toast.success(t("purchasePosted"));
    },
    onError: (error) => {
      setConfirmPost(false);
      toastError(error, t("somethingWentWrong"));
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePurchase(id),
    onSuccess: () => {
      refresh();
      router.push(`/${lang}/admin/purchases`);
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }
  if (!purchase) return <Typography color="text.secondary">{t("noData")}</Typography>;

  const supplier = typeof purchase.supplier === "object" ? purchase.supplier : undefined;
  const posted = purchase.status === "posted";
  const money = (minor: number) => formatMinorMoney(minor, currency);

  return (
    <Box py={3}>
      <Stack spacing={3} maxWidth={1000}>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2} gap={2} flexWrap="wrap">
            <Stack>
              <Typography variant="h6" fontWeight={700}>
                {t("purchaseNumber", { number: purchase.purchaseNumber })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {supplier?.name} · {t("receivedOn")} {formatDateTime(purchase.date, lang)}
                {purchase.supplierInvoiceNo ? ` · ${t("supplierInvoiceNo")} ${purchase.supplierInvoiceNo}` : ""}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip color={posted ? "success" : "default"} label={t(`purchaseStatus.${purchase.status}`)} />
              {!posted && (
                <>
                  <Button onClick={() => setEditing((n) => n + 1)}>{t("edit")}</Button>
                  <Button color="error" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    {t("delete")}
                  </Button>
                  <Button variant="contained" onClick={() => setConfirmPost(true)}>
                    {t("postPurchase")}
                  </Button>
                </>
              )}
              {posted && (
                <>
                  <Button color="warning" onClick={() => setReturning((n) => n + 1)}>
                    {t("returnToSupplier")}
                  </Button>
                  <Button variant="contained" disabled={purchase.owedMinor <= 0} onClick={() => setPaying(true)}>
                    {t("pay")}
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("product")}</TableCell>
                <TableCell align="right">{t("quantity")}</TableCell>
                <TableCell align="right">{t("unitCost")}</TableCell>
                <TableCell align="right">{t("landedShare")}</TableCell>
                <TableCell align="right">{t("valueAtCost")}</TableCell>
                {posted && <TableCell align="right">{t("returned")}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {purchase.lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {line.name[lang] ?? line.name.en}
                    {line.variantLabel ? ` — ${line.variantLabel}` : ""}
                  </TableCell>
                  <TableCell align="right">{line.quantity}</TableCell>
                  <TableCell align="right">{money(line.unitCostMinor)}</TableCell>
                  <TableCell align="right">{money(line.landedMinor)}</TableCell>
                  <TableCell align="right">{money(line.valueMinor)}</TableCell>
                  {posted && <TableCell align="right">{line.returnedQty || "—"}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />
          <Stack spacing={0.5} alignItems="flex-end">
            <Typography variant="body2">{t("subtotal")}: {money(purchase.subtotalMinor)}</Typography>
            <Typography variant="body2">{t("landedCost")}: {money(purchase.landedCostMinor)}</Typography>
            <Typography variant="subtitle1" fontWeight={700}>{t("total")}: {money(purchase.totalMinor)}</Typography>
            {posted && (
              <>
                <Typography variant="body2" color="text.secondary">{t("paid")}: {money(purchase.paidMinor)}</Typography>
                <Typography variant="body2" color="text.secondary">{t("returned")}: {money(purchase.returnedMinor)}</Typography>
                <Typography variant="subtitle2" fontWeight={700} color={purchase.owedMinor > 0 ? "warning.main" : "success.main"}>
                  {t("owed")}: {money(purchase.owedMinor)}
                </Typography>
              </>
            )}
          </Stack>
          {!posted && <Alert severity="info" sx={{ mt: 2 }}>{t("purchaseDraftHint")}</Alert>}
        </Paper>

        {posted && (purchase.payments.length > 0 || purchase.returns.length > 0) && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              {t("history")}
            </Typography>
            <Stack spacing={1}>
              {purchase.payments.map((p) => (
                <Typography key={p._id} variant="body2">
                  {formatDateTime(p.date, lang)} · {t("supplierPaymentNumber", { number: p.paymentNumber })} ·{" "}
                  {money(p.allocations.filter((a) => a.purchase === purchase._id).reduce((s, a) => s + a.amountMinor, 0))}
                </Typography>
              ))}
              {purchase.returns.map((r) => (
                <Typography key={r._id} variant="body2">
                  {formatDateTime(r.date, lang)} · {t("supplierReturnNumber", { number: r.returnNumber })} · {money(r.totalMinor)}
                  {r.note ? ` · “${r.note}”` : ""}
                </Typography>
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>

      <Dialog open={confirmPost} onClose={() => setConfirmPost(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("postPurchaseTitle", { number: purchase.purchaseNumber })}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t("postPurchaseHint", { total: money(purchase.totalMinor) })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPost(false)}>{t("back")}</Button>
          <Button variant="contained" disabled={post.isPending} onClick={() => post.mutate()}>
            {t("postPurchase")}
          </Button>
        </DialogActions>
      </Dialog>

      {editing > 0 && (
        <PurchaseFormDialog key={editing} open purchase={purchase} onClose={() => setEditing(0)} onSaved={() => setEditing(0)} />
      )}
      {returning > 0 && <ReturnToSupplierDialog key={returning} open purchase={purchase} onClose={() => setReturning(0)} />}
      {paying && supplier && (
        <PaySupplierDialog
          supplier={{ _id: supplier._id, name: supplier.name, isActive: true, owedMinor: purchase.owedMinor }}
          onClose={() => setPaying(false)}
        />
      )}
    </Box>
  );
};

export default PurchasePage;
