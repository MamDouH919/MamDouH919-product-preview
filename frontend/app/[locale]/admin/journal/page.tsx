"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  JournalEntry,
  JournalFilters,
  useJournalQuery,
} from "@/backend-api/accounting/api";
import { useCurrency } from "@/Hooks/useCurrency";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import PageActions, { PageActionButton } from "@/components/PageActions";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatMinorMoney } from "@/features/Order/format";
import AccountSelect from "@/features/Accounting/AccountSelect";
import ManualEntryDialog from "@/features/Accounting/ManualEntryDialog";
import JournalEntryDialog from "@/features/Accounting/JournalEntryDialog";
import {
  formatDay,
  monthStartInput,
  todayLocalInput,
  useLocalName,
  useSourceLabel,
} from "@/features/Accounting/shared";

const SOURCES = [
  "manual",
  "order",
  "payment",
  "refund",
  "expense",
  "purchase",
  "purchase_return",
  "supplier_payment",
  "courier_settlement",
  "money_transfer",
  "money_account_opening",
  "stock_movement",
];

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
  const [filters, setFilters] = useState<JournalFilters>({
    from: monthStartInput(),
    to: todayLocalInput(),
    page: 1,
    limit: 25,
  });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const { data, isLoading } = useJournalQuery(filters);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("accounting.journalEntries") }],
        breadCrumbBtns: [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search as the user stops typing.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((f) =>
          f.search === (search.trim() || undefined)
            ? f
            : { ...f, search: search.trim() || undefined, page: 1 },
        ),
      400,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const patch = (p: Partial<JournalFilters>) =>
    setFilters((f) => ({ ...f, ...p, page: 1 }));

  const chips = [
    ...(filters.source
      ? [
          {
            key: "source",
            label: t(`accounting.sourceTypes.${filters.source}`),
            onDelete: () => patch({ source: undefined }),
          },
        ]
      : []),
    ...(filters.account
      ? [
          {
            key: "account",
            label: `${t("accounting.accounts")}: ${filters.account}`,
            onDelete: () => patch({ account: undefined }),
          },
        ]
      : []),
    ...(filters.from || filters.to
      ? [
          {
            key: "date",
            label: `${filters.from ?? "…"} → ${filters.to ?? "…"}`,
            onDelete: () => patch({ from: undefined, to: undefined }),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: "search",
            label: `${t("search")}: ${search}`,
            onDelete: () => setSearch(""),
          },
        ]
      : []),
  ];

  const columns = useMemo(
    () => [
      {
        id: "date",
        header: t("date"),
        render: (e: JournalEntry) => formatDay(e.date, i18n.language),
      },
      {
        id: "number",
        header: "#",
        render: (e: JournalEntry) => (
          <Typography variant="body2" fontFamily="monospace">
            {e.entryNumber}
          </Typography>
        ),
      },
      {
        id: "source",
        header: t("source"),
        render: (e: JournalEntry) => (
          <Stack spacing={0.5} alignItems="flex-start">
            <Chip
              size="small"
              variant="outlined"
              color={e.isManual ? "primary" : "default"}
              label={sourceLabel(e.source)}
            />
            {e.isReversal && (
              <Chip
                size="small"
                color="warning"
                label={t("accounting.reversal")}
              />
            )}
            {e.isReversed && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t("accounting.reversed")}
              />
            )}
          </Stack>
        ),
      },
      {
        id: "lines",
        header: t("accounting.accounts"),
        render: (e: JournalEntry) => (
          <Stack spacing={0.25}>
            {e.memo && <Typography variant="body2">{name(e.memo)}</Typography>}
            {e.lines.map((l, i) => (
              <Typography
                key={i}
                variant="caption"
                color="text.secondary"
                sx={{ ps: l.creditMinor ? 2 : 0 }}
              >
                {`${l.debitMinor ? t("debitSide") : t("creditSide")} ${l.account} ${name(l.name)} — ${formatMinorMoney(l.debitMinor || l.creditMinor, currency)}`}
              </Typography>
            ))}
          </Stack>
        ),
      },
      {
        id: "amount",
        header: t("amount"),
        render: (e: JournalEntry) => formatMinorMoney(e.totalMinor, currency),
      },
      {
        id: "actions",
        header: "",
        render: (e: JournalEntry) => (
          <Button size="small" onClick={() => setViewing(e._id)}>
            {t("accounting.view")}
          </Button>
        ),
      },
    ],
    [t, i18n.language, currency, name, sourceLabel],
  );

  return (
    <Stack spacing={2} height="100%">
      <PageActions>
        <PageActionButton
          variant="contained"
          disableElevation
          onClick={() => setCreating((n) => n + 1)}
          sx={{
            borderColor: "transparent",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          {t("accounting.newEntry")}
        </PageActionButton>
      </PageActions>
      <FilterLayout
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("accounting.searchEntries"),
        }}
        activeCount={chips.length}
        chips={chips}
        onClear={() => {
          setSearch("");
          setFilters((f) => ({ page: 1, limit: f.limit }));
        }}
        filters={
          <>
            <FilterSelect
              label={t("source")}
              value={filters.source}
              onChange={(source) => patch({ source })}
              options={SOURCES.map((s) => ({
                value: s,
                label: t(`accounting.sourceTypes.${s}`),
              }))}
            />
            <AccountSelect
              value={filters.account ?? ""}
              onChange={(account) => patch({ account: account || undefined })}
            />
            <Stack direction="row" gap={1}>
              <TextField
                size="small"
                type="date"
                label={t("from")}
                value={filters.from ?? ""}
                onChange={(e) => patch({ from: e.target.value || undefined })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                type="date"
                label={t("to")}
                value={filters.to ?? ""}
                onChange={(e) => patch({ to: e.target.value || undefined })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </>
        }
      >
        <SimpleTable
          columns={columns}
          data={data?.rows ?? []}
          height="100%"
          loading={isLoading}
          pagination={{
            count: data?.total ?? 0,
            page: (filters.page ?? 1) - 1,
            rowsPerPage: filters.limit ?? 25,
            onPageChange: (p) => setFilters((f) => ({ ...f, page: p + 1 })),
            onRowsPerPageChange: (limit) => patch({ limit }),
          }}
        />
      </FilterLayout>
      {creating > 0 && (
        <ManualEntryDialog
          key={creating}
          onClose={() => setCreating(0)}
          onPosted={(entry) => setViewing(entry._id)}
        />
      )}
      {viewing && (
        <JournalEntryDialog
          key={viewing}
          id={viewing}
          onClose={() => setViewing(null)}
          onOpenEntry={setViewing}
          onOpenAccount={(code) =>
            router.push(`/${i18n.language}/admin/ledger?account=${code}`)
          }
        />
      )}
    </Stack>
  );
};

export default JournalPage;
