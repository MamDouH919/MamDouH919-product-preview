"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { ACCOUNTING_QUERY_KEYS, reverseEntry, useJournalEntryQuery } from "@/backend-api/accounting/api";
import { useCurrency } from "@/Hooks/useCurrency";
import TableLoading from "@/components/Table/TableLoading";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";
import { toastError } from "@/features/Purchasing/shared";
import { formatDay, todayLocalInput, useLocalName, useSourceLabel } from "./shared";

/**
 * One journal entry: its lines, where it came from, and — for a manual entry
 * not yet reversed — a way to cancel it with its mirror image.
 */
const JournalEntryDialog = ({ id, onClose, onOpenEntry, onOpenAccount }: { id: string; onClose: () => void; onOpenEntry?: (id: string) => void; onOpenAccount?: (code: string) => void }) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const name = useLocalName();
  const sourceLabel = useSourceLabel();
  const { data: entry, isLoading } = useJournalEntryQuery(id);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayLocalInput());

  const reverse = useMutation({
    mutationFn: () => reverseEntry({ id, reason: reason.trim(), date }),
    onSuccess: () => {
      ACCOUNTING_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(t("accounting.entryReversed"));
      setReversing(false);
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const money = (minor: number) => (minor ? formatMinorMoney(minor, currency) : "");
  const canReverse = entry?.isManual && !entry.isReversal && !entry.isReversed;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{entry ? `${t("accounting.entry")} #${entry.entryNumber}` : t("accounting.entry")}</DialogTitle>
      <DialogContent>
        {isLoading || !entry ? (
          <TableLoading />
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={formatDay(entry.date, i18n.language)} />
              <Chip size="small" variant="outlined" color={entry.isManual ? "primary" : "default"} label={sourceLabel(entry.source)} />
              {entry.isReversal && <Chip size="small" color="warning" label={t("accounting.reversal")} />}
              {entry.isReversed && <Chip size="small" color="warning" variant="outlined" label={t("accounting.reversed")} />}
            </Stack>
            {entry.memo && <Typography variant="body2">{name(entry.memo)}</Typography>}
            <Paper variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t("account")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("note")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{t("debit")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{t("credit")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entry.lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ ps: l.creditMinor ? 4 : 2 }}>
                        {onOpenAccount ? (
                          <Link component="button" type="button" underline="hover" onClick={() => onOpenAccount(l.account)}>{`${l.account} · ${name(l.name)}`}</Link>
                        ) : (
                          `${l.account} · ${name(l.name)}`
                        )}
                        {l.moneyAccount?.name && <Typography variant="caption" color="text.secondary" display="block">{l.moneyAccount.name}</Typography>}
                      </TableCell>
                      <TableCell>{l.note ?? ""}</TableCell>
                      <TableCell align="right">{money(l.debitMinor)}</TableCell>
                      <TableCell align="right">{money(l.creditMinor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ fontWeight: 700 }}>{t("total")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMinorMoney(entry.totalMinor, currency)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMinorMoney(entry.totalMinor, currency)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
            <Typography variant="caption" color="text.secondary">
              {t("accounting.postedAt", { at: formatDateTime(entry.postedAt, i18n.language) })}
              {entry.createdBy ? ` · ${t("accounting.by", { name: entry.createdBy.name })}` : ""}
            </Typography>
            {entry.reversedBy && onOpenEntry && (
              <Box>
                <Link component="button" type="button" onClick={() => onOpenEntry(entry.reversedBy!._id)}>{t("accounting.reversedByEntry", { number: entry.reversedBy.entryNumber })}</Link>
              </Box>
            )}
            {entry.reversalOf && onOpenEntry && (
              <Box>
                <Link component="button" type="button" onClick={() => onOpenEntry(entry.reversalOf!)}>{t("accounting.openOriginal")}</Link>
              </Box>
            )}
            {!entry.isManual && <Alert severity="info" icon={false}><Typography variant="caption">{t("accounting.automaticHint")}</Typography></Alert>}
            {reversing && (
              <Stack spacing={2} sx={{ p: 2, border: 1, borderColor: "warning.main", borderRadius: 1 }}>
                <Typography variant="body2">{t("accounting.reverseHint")}</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField size="small" type="date" label={t("date")} value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayLocalInput() } }} />
                  <TextField size="small" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} required sx={{ flex: 1 }} autoFocus />
                </Stack>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        {canReverse && !reversing && <Button color="warning" onClick={() => setReversing(true)}>{t("accounting.reverse")}</Button>}
        {reversing && (
          <Button color="warning" variant="contained" disabled={!reason.trim() || !date || reverse.isPending} onClick={() => reverse.mutate()}>
            {t("accounting.confirmReverse")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default JournalEntryDialog;
