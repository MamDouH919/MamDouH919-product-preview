"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Box, Button, Chip, MenuItem, Stack, TablePagination, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { JournalEntry, JournalFilters, useJournalQuery } from "@/backend-api/accounting/api";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatMinorMoney } from "@/features/Order/format";
import AccountSelect from "@/features/Accounting/AccountSelect";
import ManualEntryDialog from "@/features/Accounting/ManualEntryDialog";
import JournalEntryDialog from "@/features/Accounting/JournalEntryDialog";
import { formatDay, monthStartInput, todayLocalInput, useLocalName, useSourceLabel } from "@/features/Accounting/shared";

const SOURCES = ["manual", "order", "payment", "refund", "expense", "purchase", "purchase_return", "supplier_payment", "courier_settlement", "money_transfer", "money_account_opening", "stock_movement"];

/**
 * The journal: every entry in the books, newest first — those staff type in
 * by hand and those business events post. Each entry's lines go on to the
 * statements of the accounts they name.
 */
const JournalPage = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const currency = useCurrency();
  const name = useLocalName();
  const sourceLabel = useSourceLabel();
  const [filters, setFilters] = useState<JournalFilters>({ from: monthStartInput(), to: todayLocalInput(), page: 1, limit: 25 });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const { data, isLoading } = useJournalQuery(filters);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("accounting.journalEntries") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search as the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === (search.trim() || undefined) ? f : { ...f, search: search.trim() || undefined, page: 1 })), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const patch = (p: Partial<JournalFilters>) => setFilters((f) => ({ ...f, ...p, page: 1 }));

  const columns = useMemo(
    () => [
      { id: "date", header: t("date"), render: (e: JournalEntry) => formatDay(e.date, i18n.language) },
      { id: "number", header: "#", render: (e: JournalEntry) => <Typography variant="body2" fontFamily="monospace">{e.entryNumber}</Typography> },
      {
        id: "source",
        header: t("source"),
        render: (e: JournalEntry) => (
          <Stack spacing={0.5} alignItems="flex-start">
            <Chip size="small" variant="outlined" color={e.isManual ? "primary" : "default"} label={sourceLabel(e.source)} />
            {e.isReversal && <Chip size="small" color="warning" label={t("accounting.reversal")} />}
            {e.isReversed && <Chip size="small" color="warning" variant="outlined" label={t("accounting.reversed")} />}
          </Stack>
        ),
      },
      {
        id: "lines",
        header: t("accounting.accounts"),
        render: (e: JournalEntry) => (
          <Stack spacing={0.25}>
            {e.memo && <Typography variant="body2">{e.memo}</Typography>}
            {e.lines.map((l, i) => (
              <Typography key={i} variant="caption" color="text.secondary" sx={{ ps: l.creditMinor ? 2 : 0 }}>
                {`${l.debitMinor ? t("debitSide") : t("creditSide")} ${l.account} ${name(l.name)} — ${formatMinorMoney(l.debitMinor || l.creditMinor, currency)}`}
              </Typography>
            ))}
          </Stack>
        ),
      },
      { id: "amount", header: t("amount"), render: (e: JournalEntry) => formatMinorMoney(e.totalMinor, currency) },
      { id: "actions", header: "", render: (e: JournalEntry) => <Button size="small" onClick={() => setViewing(e._id)}>{t("accounting.view")}</Button> },
    ],
    [t, i18n.language, currency, name, sourceLabel],
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField size="small" type="date" label={t("from")} value={filters.from ?? ""} onChange={(e) => patch({ from: e.target.value || undefined })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label={t("to")} value={filters.to ?? ""} onChange={(e) => patch({ to: e.target.value || undefined })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select size="small" label={t("source")} value={filters.source ?? ""} onChange={(e) => patch({ source: e.target.value || undefined })} sx={{ minWidth: 180 }}>
          <MenuItem value="">{t("all")}</MenuItem>
          {SOURCES.map((s) => <MenuItem key={s} value={s}>{t(`accounting.sourceTypes.${s}`)}</MenuItem>)}
        </TextField>
        <Box minWidth={240}>
          <AccountSelect value={filters.account ?? ""} onChange={(account) => patch({ account: account || undefined })} />
        </Box>
        <TextField size="small" label={t("search")} placeholder={t("accounting.searchEntries")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Box flex={1} />
        <Button variant="contained" onClick={() => setCreating((n) => n + 1)}>{t("accounting.newEntry")}</Button>
      </Stack>
      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data?.rows ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>
      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={(filters.page ?? 1) - 1}
        onPageChange={(_, p) => setFilters((f) => ({ ...f, page: p + 1 }))}
        rowsPerPage={filters.limit ?? 25}
        onRowsPerPageChange={(e) => patch({ limit: parseInt(e.target.value, 10) })}
        rowsPerPageOptions={[25, 50, 100]}
      />
      {creating > 0 && <ManualEntryDialog key={creating} onClose={() => setCreating(0)} onPosted={(entry) => setViewing(entry._id)} />}
      {viewing && (
        <JournalEntryDialog
          key={viewing}
          id={viewing}
          onClose={() => setViewing(null)}
          onOpenEntry={setViewing}
          onOpenAccount={(code) => router.push(`/${i18n.language}/admin/ledger?account=${code}`)}
        />
      )}
    </Stack>
  );
};

export default JournalPage;
