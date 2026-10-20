"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TablePagination, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { createExpense, EXPENSES_QUERY_KEY, ExpenseFilters, reverseExpense, useExpensesQuery } from "@/backend-api/expenses/api";
import { EXPENSE_ACCOUNTS, Expense, ExpenseAccount } from "@/backend-api/expenses/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";
import { AMOUNT, toastError, todayInput } from "@/features/Purchasing/shared";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";

/** The store's running costs: recorded from cash, reversed (never edited) when wrong. */
const ExpensesPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const [filters, setFilters] = useState<ExpenseFilters>({ page: 1, limit: 50 });
  const { data, isLoading } = useExpensesQuery(filters);
  const [creating, setCreating] = useState(0);
  const [reversing, setReversing] = useState<Expense | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("expenses") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverse = useMutation({
    mutationFn: reverseExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY] });
      setReversing(null);
      setReason("");
      toast.success(t("expenseReversed"));
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const columns = useMemo(
    () => [
      {
        id: "date",
        header: t("date"),
        render: (row: Expense) => (
          <Stack>
            <Typography variant="body2">{formatDateTime(row.date, i18n.language)}</Typography>
            <Typography variant="caption" color="text.secondary">#{row.expenseNumber}</Typography>
          </Stack>
        ),
      },
      { id: "account", header: t("category"), render: (row: Expense) => t(`expenseAccount.${row.account}`) },
      {
        id: "description",
        header: t("description"),
        render: (row: Expense) => (
          <Stack>
            <Typography variant="body2" sx={{ textDecoration: row.status === "reversed" ? "line-through" : "none" }}>{row.description}</Typography>
            <Typography variant="caption" color="text.secondary">
              {[row.reference, row.orderNumber ? `#${row.orderNumber}` : null, row.status === "reversed" ? `${t("reversed")}: ${row.reverseReason}` : null]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          </Stack>
        ),
      },
      { id: "amount", header: t("amount"), render: (row: Expense) => formatMinorMoney(row.amountMinor, currency) },
      {
        id: "actions",
        header: "",
        render: (row: Expense) =>
          row.status === "posted" ? (
            <Button size="small" color="error" onClick={() => setReversing(row)}>{t("reverse")}</Button>
          ) : (
            <Chip size="small" label={t("reversed")} />
          ),
      },
    ],
    [t, i18n.language, currency],
  );

  const totals = Object.entries(data?.totalsByAccount ?? {}) as [ExpenseAccount, number][];
  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField size="small" type="date" label={t("from")} value={filters.from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined, page: 1 }))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label={t("to")} value={filters.to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined, page: 1 }))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select size="small" label={t("category")} value={filters.account ?? ""} onChange={(e) => setFilters((f) => ({ ...f, account: e.target.value || undefined, page: 1 }))} sx={{ minWidth: 200 }}>
          <MenuItem value="">{t("all")}</MenuItem>
          {EXPENSE_ACCOUNTS.map((a) => <MenuItem key={a} value={a}>{t(`expenseAccount.${a}`)}</MenuItem>)}
        </TextField>
        <Box flex={1} />
        <Button variant="contained" onClick={() => setCreating((n) => n + 1)}>{t("newExpense")}</Button>
      </Stack>
      {totals.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {totals.map(([account, total]) => (
            <Chip key={account} variant="outlined" label={`${t(`expenseAccount.${account}`)}: ${formatMinorMoney(total, currency)}`} />
          ))}
        </Stack>
      )}
      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data?.data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>
      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={(filters.page ?? 1) - 1}
        onPageChange={(_, p) => setFilters((f) => ({ ...f, page: p + 1 }))}
        rowsPerPage={filters.limit ?? 50}
        onRowsPerPageChange={(e) => setFilters((f) => ({ ...f, limit: parseInt(e.target.value, 10), page: 1 }))}
        rowsPerPageOptions={[50, 100, 200]}
      />
      {creating > 0 && <ExpenseDialog key={creating} onClose={() => setCreating(0)} />}
      <Dialog open={!!reversing} onClose={() => setReversing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{reversing && t("reverseExpenseTitle", { number: reversing.expenseNumber })}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>{t("reverseExpenseHint")}</Typography>
          <TextField fullWidth size="small" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReversing(null)}>{t("back")}</Button>
          <Button color="error" variant="contained" disabled={!reason.trim() || reverse.isPending} onClick={() => reversing && reverse.mutate({ id: reversing._id, reason: reason.trim() })}>
            {t("reverse")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

const ExpenseDialog = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<ExpenseAccount>("6700");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createExpense({
        account,
        amount,
        date: new Date(date).toISOString(),
        description: description.trim(),
        reference: reference.trim() || undefined,
        moneyAccountId: moneyAccountId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY] });
      toast.success(t("expenseRecorded"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });
  const valid = AMOUNT.test(amount) && Number(amount) > 0 && !!description.trim();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("newExpense")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField select label={t("category")} value={account} onChange={(e) => setAccount(e.target.value as ExpenseAccount)}>
            {EXPENSE_ACCOUNTS.map((a) => <MenuItem key={a} value={a}>{t(`expenseAccount.${a}`)}</MenuItem>)}
          </TextField>
          <TextField label={t("amount")} value={amount} onChange={(e) => setAmount(e.target.value.trim())} error={!!amount && !AMOUNT.test(amount)} slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }} autoFocus />
          <TextField label={t("date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayInput() } }} />
          <TextField label={t("description")} value={description} onChange={(e) => setDescription(e.target.value)} required />
          <TextField label={t("receiptReference")} value={reference} onChange={(e) => setReference(e.target.value)} />
          <MoneyAccountSelect value={moneyAccountId} onChange={setMoneyAccountId} label={t("paidFrom")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>{t("save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExpensesPage;
