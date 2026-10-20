"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from "@mui/material";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { lockPeriod, PERIODS_QUERY_KEY, RECONCILIATION_QUERY_KEY, reopenPeriod, usePeriodsQuery, useReconciliationQuery } from "@/backend-api/statements/api";
import TableLoading from "@/components/Table/TableLoading";
import { formatDateTime } from "@/features/Order/format";
import { toastError } from "@/features/Purchasing/shared";

/** The day before today, as YYYY-MM-DD in the browser's zone; the server checks it against the store's. */
const yesterday = () => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Whether the books hold together, and which days are closed. Every check
 * compares two independent records of the same money; a failure lists the
 * documents involved. Only the store's super admin closes or reopens days.
 */
const BooksPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isSuper = useAppSelector((state) => state.auth.isSuper);
  const reconciliation = useReconciliationQuery();
  const periods = usePeriodsQuery();
  const [through, setThrough] = useState(yesterday());
  const [reopening, setReopening] = useState(false);
  const [reopenTo, setReopenTo] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("books") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: [PERIODS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [RECONCILIATION_QUERY_KEY] });
  };
  const lock = useMutation({
    mutationFn: () => lockPeriod(through),
    onSuccess: () => {
      done();
      toast.success(t("periodLocked", { day: through }));
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });
  const reopen = useMutation({
    mutationFn: () => reopenPeriod({ through: reopenTo || undefined, reason: reason.trim() }),
    onSuccess: () => {
      done();
      setReopening(false);
      setReason("");
      setReopenTo("");
      toast.success(t("periodReopened"));
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const report = reconciliation.data;
  const closed = periods.data?.lockedThroughDay;
  const failing = report?.checks.filter((c) => !c.ok) ?? [];
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("closedPeriods")}</Typography>
          {periods.isLoading ? (
            <TableLoading />
          ) : (
            <>
              <Typography variant="body2">{closed ? t("booksClosedThrough", { day: closed }) : t("noPeriodClosed")}</Typography>
              <Typography variant="caption" color="text.secondary">{t("closePeriodHint", { timeZone: periods.data?.timeZone ?? "" })}</Typography>
              {isSuper ? (
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
                  <TextField
                    size="small"
                    type="date"
                    label={t("closeThrough")}
                    value={through}
                    onChange={(e) => setThrough(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: yesterday(), min: closed ?? undefined } }}
                  />
                  <Button variant="contained" disabled={!through || lock.isPending || failing.length > 0 || (!!closed && through <= closed)} onClick={() => lock.mutate()}>
                    {t("closePeriod")}
                  </Button>
                  {closed && (
                    <Button color="warning" onClick={() => setReopening(true)}>{t("reopenPeriod")}</Button>
                  )}
                  {failing.length > 0 && <Typography variant="caption" color="error">{t("fixChecksBeforeClosing")}</Typography>}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">{t("onlySuperAdminCloses")}</Typography>
              )}
              {(periods.data?.history.length ?? 0) > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{t("history")}</Typography>
                  {[...periods.data!.history].reverse().map((h, i) => {
                    const to = typeof h.to === "object" && h.to !== null ? h.to : { day: h.to, reason: "" };
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        {formatDateTime(h.at, i18n.language)} · {h.from ?? "—"} → {to.day ?? t("open")}
                        {to.reason ? ` · ${to.reason}` : ""}
                      </Typography>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" flex={1}>{t("reconciliation")}</Typography>
            {report && <Chip color={report.ok ? "success" : "error"} label={report.ok ? t("allChecksPass") : t("checksFailing", { count: failing.length })} />}
            <Button onClick={() => reconciliation.refetch()} disabled={reconciliation.isFetching}>{t("runAgain")}</Button>
          </Stack>
          {reconciliation.isLoading && <TableLoading />}
          {reconciliation.isError && <Alert severity="error">{t("somethingWentWrong")}</Alert>}
          {report && (
            <Typography variant="caption" color="text.secondary">{t("checkedAt", { at: formatDateTime(report.checkedAt, i18n.language) })}</Typography>
          )}
          {report?.checks.map((c) => (
            <Stack key={c.name} direction="row" spacing={1.5} alignItems="flex-start">
              {c.ok ? <CheckCircle2 size={18} color="green" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={18} color="red" style={{ flexShrink: 0, marginTop: 2 }} />}
              <Stack spacing={0.25} minWidth={0}>
                <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                <Typography variant="caption" color="text.secondary">{c.detail}</Typography>
                {c.offenders.map((o) => (
                  <Typography key={o} variant="caption" color="error" sx={{ wordBreak: "break-word" }}>{o}</Typography>
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Dialog open={reopening} onClose={() => setReopening(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("reopenPeriod")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <Typography variant="body2" color="text.secondary">{t("reopenPeriodHint")}</Typography>
            <TextField
              size="small"
              type="date"
              label={t("keepClosedThrough")}
              helperText={t("keepClosedThroughHint")}
              value={reopenTo}
              onChange={(e) => setReopenTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: closed ?? undefined } }}
            />
            <TextField size="small" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopening(false)}>{t("back")}</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={!reason.trim() || reopen.isPending || (!!reopenTo && !!closed && reopenTo >= closed)}
            onClick={() => reopen.mutate()}
          >
            {t("reopenPeriod")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default BooksPage;
