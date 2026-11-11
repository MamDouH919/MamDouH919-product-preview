"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import { ACCOUNTING_QUERY_KEYS, CASH_ACCOUNT, createManualEntry, JournalEntry, ManualLineInput } from "@/backend-api/accounting/api";
import { useCurrency } from "@/Hooks/useCurrency";
import { formatMinorMoney } from "@/features/Order/format";
import { AMOUNT, inputToMinor, toastError } from "@/features/Purchasing/shared";
import MoneyAccountSelect from "@/features/Finance/MoneyAccountSelect";
import AccountSelect from "./AccountSelect";
import { todayLocalInput } from "./shared";

type Line = Required<Pick<ManualLineInput, "account">> & { debit: string; credit: string; moneyAccountId: string; note: string; key: number };

let nextKey = 0;
const emptyLine = (): Line => ({ account: "", debit: "", credit: "", moneyAccountId: "", note: "", key: nextKey++ });
const amountOk = (text: string) => !text || AMOUNT.test(text);

/**
 * A journal entry typed in by hand: a date, what it is for, and two or more
 * lines whose debits equal their credits. Only accounts that aren't kept by
 * their own documents (orders, stock, purchases) can be picked.
 */
const ManualEntryDialog = ({ onClose, onPosted }: { onClose: () => void; onPosted?: (entry: JournalEntry) => void }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const [date, setDate] = useState(todayLocalInput());
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const set = (key: number, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const debit = lines.reduce((t, l) => t + inputToMinor(l.debit), 0);
  const credit = lines.reduce((t, l) => t + inputToMinor(l.credit), 0);
  const filled = lines.filter((l) => l.account || l.debit || l.credit);
  const linesOk = filled.length >= 2 && filled.every((l) => l.account && amountOk(l.debit) && amountOk(l.credit) && (inputToMinor(l.debit) > 0) !== (inputToMinor(l.credit) > 0));
  const balanced = debit === credit && debit > 0;
  const valid = !!date && !!memo.trim() && linesOk && balanced;

  const mutation = useMutation({
    mutationFn: () =>
      createManualEntry({
        date,
        memo: memo.trim(),
        reference: reference.trim() || undefined,
        lines: filled.map((l) => ({
          account: l.account,
          debit: l.debit || undefined,
          credit: l.credit || undefined,
          moneyAccountId: l.account === CASH_ACCOUNT && l.moneyAccountId ? l.moneyAccountId : undefined,
          note: l.note.trim() || undefined,
        })),
      }),
    onSuccess: (entry) => {
      ACCOUNTING_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(t("accounting.entryPosted", { number: entry.entryNumber }));
      onPosted?.(entry);
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg" fullScreen={narrow}>
      <DialogTitle>{t("accounting.newEntry")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              size="small"
              type="date"
              label={t("date")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayLocalInput() } }}
            />
            <TextField size="small" label={t("accounting.memo")} value={memo} onChange={(e) => setMemo(e.target.value)} required sx={{ flex: 2 }} placeholder={t("accounting.memoPlaceholder")} />
            <TextField size="small" label={t("reference")} value={reference} onChange={(e) => setReference(e.target.value)} sx={{ flex: 1 }} />
          </Stack>

          <Stack spacing={1.5}>
            {lines.map((l, i) => (
              <Stack key={l.key} direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "flex-start" }} sx={{ p: { xs: 1.5, md: 0 }, border: { xs: 1, md: 0 }, borderColor: "divider", borderRadius: 1 }}>
                <Box flex={3} minWidth={0}>
                  <AccountSelect manualOnly value={l.account} onChange={(account) => set(l.key, { account, moneyAccountId: "" })} label={`${t("account")} ${i + 1}`} />
                </Box>
                <TextField
                  size="small"
                  label={t("debit")}
                  value={l.debit}
                  error={!amountOk(l.debit)}
                  onChange={(e) => set(l.key, { debit: e.target.value.trim(), credit: e.target.value.trim() ? "" : l.credit })}
                  slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label={t("credit")}
                  value={l.credit}
                  error={!amountOk(l.credit)}
                  onChange={(e) => set(l.key, { credit: e.target.value.trim(), debit: e.target.value.trim() ? "" : l.debit })}
                  slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
                  sx={{ flex: 1 }}
                />
                <TextField size="small" label={t("note")} value={l.note} onChange={(e) => set(l.key, { note: e.target.value })} sx={{ flex: 2 }} />
                {l.account === CASH_ACCOUNT && (
                  <Box flex={1.5}>
                    <MoneyAccountSelect value={l.moneyAccountId} onChange={(id) => set(l.key, { moneyAccountId: id })} />
                  </Box>
                )}
                <IconButton aria-label={t("accounting.removeLine")} disabled={lines.length <= 2} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}>
                  <Trash2 size={18} />
                </IconButton>
              </Stack>
            ))}
            <Box>
              <Button startIcon={<Plus size={16} />} onClick={() => setLines((all) => [...all, emptyLine()])}>{t("accounting.addLine")}</Button>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip variant="outlined" label={`${t("accounting.totalDebit")}: ${formatMinorMoney(debit, currency)}`} />
            <Chip variant="outlined" label={`${t("accounting.totalCredit")}: ${formatMinorMoney(credit, currency)}`} />
            {debit > 0 || credit > 0 ? (
              balanced ? (
                <Chip color="success" label={t("accounting.balanced")} />
              ) : (
                <Chip color="error" label={`${t("accounting.difference")}: ${formatMinorMoney(Math.abs(debit - credit), currency)}`} />
              )
            ) : null}
          </Stack>
          <Alert severity="info" icon={false}>
            <Typography variant="caption">{t("accounting.manualHint")}</Typography>
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>{t("accounting.postEntry")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualEntryDialog;
