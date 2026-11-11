"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, Chip, Link, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { CASH_ACCOUNT, downloadAccountStatementCsv, useAccountStatementQuery } from "@/backend-api/accounting/api";
import { useMoneyAccountsQuery } from "@/backend-api/money-accounts/api";
import { useCurrency } from "@/Hooks/useCurrency";
import TableLoading from "@/components/Table/TableLoading";
import { formatMinorMoney } from "@/features/Order/format";
import { toastError } from "@/features/Purchasing/shared";
import AccountSelect from "@/features/Accounting/AccountSelect";
import JournalEntryDialog from "@/features/Accounting/JournalEntryDialog";
import { formatDay, monthStartInput, todayLocalInput, useLocalName, useSourceLabel } from "@/features/Accounting/shared";

/**
 * An account's statement (its ledger): the balance brought forward, every
 * journal line posted to it in the period with the balance after it, and the
 * balance carried forward. The account comes from `?account=`, so the chart,
 * journal and trial balance can link straight here.
 */
const LedgerPage = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const currency = useCurrency();
  const name = useLocalName();
  const sourceLabel = useSourceLabel();
  const code = params.get("account") ?? "";
  const moneyAccount = params.get("moneyAccount") ?? "";
  const [range, setRange] = useState({ from: monthStartInput(), to: todayLocalInput() });
  const [viewing, setViewing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { data: moneyAccounts } = useMoneyAccountsQuery(code === CASH_ACCOUNT);
  const filters = { from: range.from || undefined, to: range.to || undefined, moneyAccount: code === CASH_ACCOUNT && moneyAccount ? moneyAccount : undefined };
  const { data, isLoading, isError } = useAccountStatementQuery(code || undefined, filters);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("accounting.accountStatement") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: { account?: string; moneyAccount?: string }) => {
    const q = new URLSearchParams();
    if (next.account) q.set("account", next.account);
    if (next.account === CASH_ACCOUNT && next.moneyAccount) q.set("moneyAccount", next.moneyAccount);
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`);
  };
  const download = async () => {
    setDownloading(true);
    try {
      await downloadAccountStatementCsv(code, filters, i18n.language);
    } catch (error) {
      toastError(error, t("somethingWentWrong"));
    } finally {
      setDownloading(false);
    }
  };

  const money = (minor: number) => (minor ? formatMinorMoney(minor, currency) : "");
  /** Positive is the account's normal side; negative shows on the other side, flagged. */
  const signed = (minor: number) => {
    if (!data || minor === 0) return formatMinorMoney(0, currency);
    const normal = data.account.normalSide;
    const side = minor > 0 ? normal : normal === "debit" ? "credit" : "debit";
    return `${formatMinorMoney(Math.abs(minor), currency)} ${t(side === "debit" ? "debitSide" : "creditSide")}`;
  };
  const head = (label: string, align: "left" | "right" = "left") => <TableCell align={align} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{label}</TableCell>;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <Box minWidth={280}>
          <AccountSelect value={code} onChange={(account) => go({ account })} />
        </Box>
        {code === CASH_ACCOUNT && (moneyAccounts?.length ?? 0) > 1 && (
          <TextField select size="small" label={t("moneyAccount")} value={moneyAccount} onChange={(e) => go({ account: code, moneyAccount: e.target.value })} sx={{ minWidth: 180 }}>
            <MenuItem value="">{t("all")}</MenuItem>
            {moneyAccounts!.map((m) => <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>)}
          </TextField>
        )}
        <TextField size="small" type="date" label={t("from")} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label={t("to")} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
        <Box flex={1} />
        {code && <Button variant="outlined" onClick={download} disabled={downloading || !data}>{t("downloadCsv")}</Button>}
      </Stack>

      {!code && <Alert severity="info">{t("accounting.pickAccountFirst")}</Alert>}
      {code && isError && <Alert severity="error">{t("somethingWentWrong")}</Alert>}
      {code && isLoading && <TableLoading />}
      {code && data && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography variant="h6" sx={{ me: 1 }}>{`${data.account.code} · ${name(data.account.name)}`}</Typography>
            <Chip size="small" variant="outlined" label={t(`accountTypes.${data.account.type}`)} />
            <Chip size="small" variant="outlined" label={`${t("accounting.normalSide")}: ${t(data.account.normalSide === "debit" ? "debit" : "credit")}`} />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip variant="outlined" label={`${t("openingBalance")}: ${signed(data.openingMinor)}`} />
            <Chip variant="outlined" label={`${t("debit")}: ${formatMinorMoney(data.debitMinor, currency)}`} />
            <Chip variant="outlined" label={`${t("credit")}: ${formatMinorMoney(data.creditMinor, currency)}`} />
            <Chip color="primary" label={`${t("closingBalance")}: ${signed(data.closingMinor)}`} />
          </Stack>
          {data.truncated && <Alert severity="warning">{t("accounting.statementTruncated")}</Alert>}
          <Paper variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {head(t("date"))}
                  {head("#")}
                  {head(t("source"))}
                  {head(t("accounting.memo"))}
                  {head(t("accounting.against"))}
                  {head(t("debit"), "right")}
                  {head(t("credit"), "right")}
                  {head(t("balance"), "right")}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} sx={{ fontWeight: 600 }}>{t("accounting.broughtForward")}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{signed(data.openingMinor)}</TableCell>
                </TableRow>
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ color: "text.secondary" }}>{t("nothingInPeriod")}</TableCell>
                  </TableRow>
                )}
                {data.rows.map((r, i) => (
                  <TableRow key={`${r.entryId}-${i}`} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDay(r.date, i18n.language)}</TableCell>
                    <TableCell>
                      <Link component="button" type="button" underline="hover" onClick={() => setViewing(r.entryId)} sx={{ fontFamily: "monospace" }}>{r.entryNumber}</Link>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{sourceLabel(r.source)}</TableCell>
                    <TableCell>
                      {[r.memo && name(r.memo), r.note].filter(Boolean).join(" · ")}
                      {r.moneyAccount && !moneyAccount && <Typography variant="caption" color="text.secondary" display="block">{r.moneyAccount}</Typography>}
                    </TableCell>
                    <TableCell>
                      {r.counterparts.map((c) => (
                        <Link key={c.code} component="button" type="button" underline="hover" display="block" onClick={() => go({ account: c.code })} sx={{ textAlign: "start" }}>
                          {`${c.code} ${name(c.name)}`}
                        </Link>
                      ))}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{money(r.debitMinor)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{money(r.creditMinor)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" color={r.balanceMinor < 0 ? "warning.main" : undefined}>{signed(r.balanceMinor)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} sx={{ fontWeight: 700 }}>{t("accounting.carriedForward")}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatMinorMoney(data.debitMinor, currency)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatMinorMoney(data.creditMinor, currency)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{signed(data.closingMinor)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
      {viewing && <JournalEntryDialog key={viewing} id={viewing} onClose={() => setViewing(null)} onOpenEntry={setViewing} onOpenAccount={(c) => { setViewing(null); go({ account: c }); }} />}
    </Stack>
  );
};

/** `useSearchParams` needs a Suspense boundary so the page can still prerender. */
const LedgerPageWithBoundary = () => (
  <Suspense fallback={<TableLoading />}>
    <LedgerPage />
  </Suspense>
);

export default LedgerPageWithBoundary;
