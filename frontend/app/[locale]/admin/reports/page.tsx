"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, Chip, Link, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import {
  AGE_BUCKETS,
  AgeBucket,
  BalanceSheet,
  CashFlow,
  DayRange,
  DebitCredit,
  downloadReportCsv,
  Payables,
  ProfitAndLoss,
  Receivables,
  Report,
  SalesByProduct,
  StatementLine,
  TrialBalance,
  useInventoryValuationQuery,
  useReportQuery,
} from "@/backend-api/statements/api";
import { useCurrency } from "@/Hooks/useCurrency";
import TableLoading from "@/components/Table/TableLoading";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";
import { toastError } from "@/features/Purchasing/shared";

type Tab = Report | "valuation";
/** In the order the books are read: trial balance, then the three statements, then the working reports. */
const TABS: Tab[] = ["trial-balance", "profit-and-loss", "balance-sheet", "cash-flow", "receivables", "payables", "valuation", "sales-by-product"];
/** Reports of what is owed or held now take no date range; the balance sheet takes only an end day. */
const RANGE: Record<Tab, "range" | "asOf" | "none"> = {
  "profit-and-loss": "range",
  "cash-flow": "range",
  "sales-by-product": "range",
  "trial-balance": "range",
  "balance-sheet": "asOf",
  receivables: "none",
  payables: "none",
  valuation: "none",
};

const monthStart = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const useName = () => {
  const { i18n } = useTranslation();
  return (name?: Partial<Record<"en" | "ar", string>>) => (i18n.language === "ar" ? name?.ar || name?.en : name?.en || name?.ar) ?? "";
};

/** The financial statements: every figure comes from the books, for days in the store's time zone. */
const ReportsPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("trial-balance");
  const [range, setRange] = useState<DayRange>({ from: monthStart(), to: today() });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("reports") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = RANGE[tab];
  const params: DayRange = mode === "range" ? range : mode === "asOf" ? { to: range.to } : {};
  const download = async () => {
    if (tab === "valuation") return;
    setDownloading(true);
    try {
      await downloadReportCsv(tab, params, i18n.language);
    } catch (error) {
      toastError(error, t("somethingWentWrong"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        {TABS.map((x) => <Tab key={x} value={x} label={t(`report.${x}`)} />)}
      </Tabs>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        {mode === "range" && (
          <TextField size="small" type="date" label={t("from")} value={range.from ?? ""} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))} slotProps={{ inputLabel: { shrink: true } }} />
        )}
        {mode !== "none" && (
          <TextField size="small" type="date" label={mode === "asOf" ? t("asOf") : t("to")} value={range.to ?? ""} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))} slotProps={{ inputLabel: { shrink: true } }} />
        )}
        <Typography variant="caption" color="text.secondary">{t(`reportHint.${tab}`)}</Typography>
        <Box flex={1} />
        {tab !== "valuation" && (
          <Button variant="outlined" onClick={download} disabled={downloading}>{t("downloadCsv")}</Button>
        )}
      </Stack>
      {tab === "profit-and-loss" && <ProfitAndLossReport range={params} />}
      {tab === "balance-sheet" && <BalanceSheetReport range={params} />}
      {tab === "cash-flow" && <CashFlowReport range={params} />}
      {tab === "receivables" && <ReceivablesReport />}
      {tab === "payables" && <PayablesReport />}
      {tab === "valuation" && <ValuationReport />}
      {tab === "trial-balance" && <TrialBalanceReport range={params} />}
      {tab === "sales-by-product" && <SalesByProductReport range={params} />}
    </Stack>
  );
};

/** A plain table: one header row, body rows, and an optional bold total row. */
const Grid = ({ head, rows, total }: { head: string[]; rows: React.ReactNode[][]; total?: React.ReactNode[] }) => {
  const { t } = useTranslation();
  return (
    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>{head.map((h, i) => <TableCell key={i} align={i === 0 ? "left" : "right"} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={head.length} align="center" sx={{ color: "text.secondary" }}>{t("nothingInPeriod")}</TableCell>
            </TableRow>
          )}
          {rows.map((row, r) => (
            <TableRow key={r}>{row.map((cell, i) => <TableCell key={i} align={i === 0 ? "left" : "right"}>{cell}</TableCell>)}</TableRow>
          ))}
          {total && (
            <TableRow>{total.map((cell, i) => <TableCell key={i} align={i === 0 ? "left" : "right"} sx={{ fontWeight: 700 }}>{cell}</TableCell>)}</TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
};

const ProfitAndLossReport = ({ range }: { range: DayRange }) => {
  const { t } = useTranslation();
  const currency = useCurrency();
  const name = useName();
  const { data, isLoading } = useReportQuery<ProfitAndLoss>("profit-and-loss", range);
  if (isLoading || !data) return <TableLoading />;
  const money = (minor?: number) => (minor === undefined ? "—" : formatMinorMoney(minor, currency));
  const compare = !!data.previousTotals;
  const head = [t("account"), t("amount"), ...(compare ? [t("previousPeriod")] : [])];
  // Contra-revenue (discounts, returns) is shown as a deduction.
  const sign = (l: StatementLine) => (l.type === "contra_revenue" ? -1 : 1);
  const lines = (list: StatementLine[]) =>
    list.map((l) => [`${l.code} · ${name(l.name)}`, money(sign(l) * l.amountMinor), ...(compare ? [money(l.previousMinor === undefined ? undefined : sign(l) * l.previousMinor)] : [])]);
  const total = (label: string, key: keyof ProfitAndLoss["totals"]) => [label, money(data.totals[key]), ...(compare ? [money(data.previousTotals?.[key])] : [])];
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{t("revenue")}</Typography>
      <Grid head={head} rows={lines(data.revenue)} total={total(t("netRevenue"), "netRevenueMinor")} />
      <Typography variant="subtitle2">{t("costOfSales")}</Typography>
      <Grid head={head} rows={lines(data.costOfSales)} total={total(t("grossProfit"), "grossProfitMinor")} />
      <Typography variant="subtitle2">{t("expensesSection")}</Typography>
      <Grid
        head={head}
        rows={lines(data.expenses)}
        total={total(t("netProfit"), "netProfitMinor")}
      />
      <Typography variant="caption" color="text.secondary">
        {t("contributionLine", { amount: money(data.totals.contributionMinor) })}
      </Typography>
    </Stack>
  );
};

const CashFlowReport = ({ range }: { range: DayRange }) => {
  const { t } = useTranslation();
  const currency = useCurrency();
  const name = useName();
  const { data, isLoading } = useReportQuery<CashFlow>("cash-flow", range);
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip variant="outlined" label={`${t("openingBalance")}: ${money(data.openingMinor)}`} />
        <Chip variant="outlined" color="success" label={`${t("moneyIn")}: ${money(data.inflowMinor)}`} />
        <Chip variant="outlined" color="error" label={`${t("moneyOut")}: ${money(data.outflowMinor)}`} />
        <Chip variant="outlined" label={`${t("closingBalance")}: ${money(data.closingMinor)}`} />
      </Stack>
      {data.sections.map((section) => (
        <Stack key={section.activity} spacing={1}>
          <Typography variant="subtitle2">{t(`accounting.activityHeading.${section.activity}`)}</Typography>
          <Grid
            head={[t("source"), t("amount")]}
            rows={section.lines.map((l) => [
              l.name ? `${l.code ? `${l.code} · ` : ""}${name(l.name)}` : t(`cashSource.${l.key}`, { defaultValue: t(`accounting.sourceTypes.${l.key}`, { defaultValue: l.key }) }),
              money(l.amountMinor),
            ])}
            total={[t(`accounting.activityNet.${section.activity}`), money(section.netMinor)]}
          />
        </Stack>
      ))}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={0.5}>
          <Row label={t("openingBalance")} value={money(data.openingMinor)} />
          <Row label={t("netCashFlow")} value={money(data.netMinor)} />
          <Row label={t("closingBalance")} value={money(data.closingMinor)} bold />
        </Stack>
      </Paper>
      <Typography variant="subtitle2">{t("moneyAccounts")}</Typography>
      <Grid
        head={[t("moneyAccount"), t("openingBalance"), t("closingBalance")]}
        rows={data.accounts.map((a) => [a.name, money(a.openingMinor), money(a.closingMinor)])}
        total={[t("total"), money(data.openingMinor), money(data.closingMinor)]}
      />
    </Stack>
  );
};

/** One label and amount on a line, for statement subtotals. */
const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <Stack direction="row" justifyContent="space-between" spacing={2}>
    <Typography variant="body2" fontWeight={bold ? 700 : undefined}>{label}</Typography>
    <Typography variant="body2" fontWeight={bold ? 700 : undefined}>{value}</Typography>
  </Stack>
);

const BalanceSheetReport = ({ range }: { range: DayRange }) => {
  const { t } = useTranslation();
  const currency = useCurrency();
  const name = useName();
  const { data, isLoading } = useReportQuery<BalanceSheet>("balance-sheet", range);
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  const lines = (section: BalanceSheet["assets"]) => section.lines.map((l) => [`${l.code} · ${name(l.name)}`, money(l.amountMinor)]);
  return (
    <Stack spacing={2}>
      {data.balanced ? <Alert severity="success">{t("accounting.balanceSheetBalanced")}</Alert> : <Alert severity="error">{t("accounting.balanceSheetNotBalanced")}</Alert>}
      <Typography variant="subtitle2">{t("accounting.categories.assets")}</Typography>
      <Grid head={[t("account"), t("amount")]} rows={lines(data.assets)} total={[t("accounting.totalAssets"), money(data.totalAssetsMinor)]} />
      <Typography variant="subtitle2">{t("accounting.categories.liabilities")}</Typography>
      <Grid head={[t("account"), t("amount")]} rows={lines(data.liabilities)} total={[t("accounting.totalLiabilities"), money(data.liabilities.totalMinor)]} />
      <Typography variant="subtitle2">{t("accounting.categories.equity")}</Typography>
      <Grid
        head={[t("account"), t("amount")]}
        rows={[...lines(data.equity), [t("accounting.currentEarnings"), money(data.equity.currentEarningsMinor)]]}
        total={[t("accounting.totalEquity"), money(data.equity.totalMinor)]}
      />
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={0.5}>
          <Row label={t("accounting.totalAssets")} value={money(data.totalAssetsMinor)} bold />
          <Row label={t("accounting.totalLiabilitiesAndEquity")} value={money(data.totalLiabilitiesAndEquityMinor)} bold />
        </Stack>
      </Paper>
      <Typography variant="caption" color="text.secondary">{t("accounting.currentEarningsHint")}</Typography>
    </Stack>
  );
};

const Buckets = ({ buckets, total }: { buckets: Record<AgeBucket, number>; total: number }) => {
  const { t } = useTranslation();
  const currency = useCurrency();
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {AGE_BUCKETS.map((b) => (
        <Chip key={b} variant="outlined" color={b === "61_plus" && buckets[b] > 0 ? "error" : "default"} label={`${t(`ageBucket.${b}`)}: ${formatMinorMoney(buckets[b], currency)}`} />
      ))}
      <Chip color="primary" label={`${t("total")}: ${formatMinorMoney(total, currency)}`} />
    </Stack>
  );
};

const ReceivablesReport = () => {
  const { t, i18n } = useTranslation();
  const currency = useCurrency();
  const { data, isLoading } = useReportQuery<Receivables>("receivables", {});
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  return (
    <Stack spacing={2}>
      <Buckets buckets={data.buckets} total={data.totalMinor} />
      <Grid
        head={[t("orderColumn"), t("customer"), t("deliveredAt"), t("total"), t("collected"), t("owed"), t("days")]}
        rows={data.rows.map((r) => [
          `#${r.orderNumber}`,
          <Stack key="c" alignItems="flex-end"><span>{r.customer}</span><Typography variant="caption" color="text.secondary" dir="ltr">{r.phone}</Typography></Stack>,
          r.deliveredAt ? formatDateTime(r.deliveredAt, i18n.language) : "—",
          money(r.totalMinor),
          money(r.collectedMinor),
          money(r.owedMinor),
          r.days,
        ])}
      />
    </Stack>
  );
};

const PayablesReport = () => {
  const { t, i18n } = useTranslation();
  const currency = useCurrency();
  const { data, isLoading } = useReportQuery<Payables>("payables", {});
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  return (
    <Stack spacing={2}>
      <Buckets buckets={data.buckets} total={data.totalMinor} />
      <Grid
        head={[t("purchaseColumn"), t("supplier"), t("date"), t("dueDate"), t("total"), t("owed"), t("days"), t("overdueDays")]}
        rows={data.rows.map((r) => [
          `#${r.purchaseNumber}${r.supplierInvoiceNo ? ` · ${r.supplierInvoiceNo}` : ""}`,
          r.supplier ?? "—",
          formatDateTime(r.date, i18n.language),
          r.dueDate ? formatDateTime(r.dueDate, i18n.language) : "—",
          money(r.totalMinor),
          money(r.owedMinor),
          r.days,
          r.overdueDays ? <Typography key="o" variant="body2" color="error">{r.overdueDays}</Typography> : "—",
        ])}
      />
    </Stack>
  );
};

const ValuationReport = () => {
  const { t } = useTranslation();
  const currency = useCurrency();
  const name = useName();
  const { data, isLoading } = useInventoryValuationQuery();
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number | null) => (minor === null ? "—" : formatMinorMoney(minor, currency));
  return (
    <Stack spacing={2}>
      {data.uncosted.length > 0 && <Alert severity="warning">{t("uncostedStock", { count: data.uncosted.length })}</Alert>}
      <Grid
        head={[t("product"), t("stock"), t("unitCost"), t("value")]}
        rows={data.rows.map((r) => [`${name(r.name)}${r.variantLabel ? ` · ${r.variantLabel}` : ""}`, r.stock, money(r.unitCostMinor), money(r.valueMinor)])}
        total={[t("total"), data.totalUnits, "", money(data.totalValueMinor)]}
      />
    </Stack>
  );
};

const TrialBalanceReport = ({ range }: { range: DayRange }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currency = useCurrency();
  const name = useName();
  const { data, isLoading } = useReportQuery<TrialBalance>("trial-balance", range);
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  const balance = (a: TrialBalance["accounts"][number]) => (a.balanceMinor === 0 ? money(0) : `${money(a.balanceMinor)} ${t(a.side === "debit" ? "debitSide" : "creditSide")}`);
  const unusual = data.accounts.filter((a) => a.isUnusual);
  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={false}>
        <Typography variant="body2">{t("trialIntro")}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>{t("trialHowToRead")}</Typography>
      </Alert>
      {data.balanced ? <Alert severity="success">{t("trialBalanced")}</Alert> : <Alert severity="error">{t("trialNotBalanced")}</Alert>}
      {unusual.length > 0 && (
        <Alert severity="warning">
          <Typography variant="body2">{t("trialUnusual")}</Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, ps: 2.5 }}>
            {unusual.map((a) => (
              <li key={a.code}>
                <Typography variant="body2">
                  <b>{name(a.name)}</b> ({balance(a)}): {t(`trialUnusualReason.${a.unusualReason}`)}
                </Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} sx={{ fontWeight: 600 }}>{t("account")}</TableCell>
              <TableCell rowSpan={2} sx={{ fontWeight: 600 }}>{t("accountKind")}</TableCell>
              {(["openingBalance", "periodTransactions", "closingBalance"] as const).map((k) => (
                <TableCell key={k} colSpan={2} align="center" sx={{ fontWeight: 600, borderInlineStart: 1, borderColor: "divider" }}>{t(k)}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              {[0, 1, 2].flatMap((g) => [
                <TableCell key={`${g}d`} align="right" sx={{ fontWeight: 600, borderInlineStart: 1, borderColor: "divider" }}>{t("debit")}</TableCell>,
                <TableCell key={`${g}c`} align="right" sx={{ fontWeight: 600 }}>{t("credit")}</TableCell>,
              ])}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ color: "text.secondary" }}>{t("nothingInPeriod")}</TableCell>
              </TableRow>
            )}
            {data.accounts.map((a) => (
              <TableRow key={a.code}>
                <TableCell>
                  <Link component="button" type="button" underline="hover" sx={{ textAlign: "start" }} onClick={() => router.push(`/${i18n.language}/admin/ledger?account=${a.code}`)}>
                    {`${a.code} · ${name(a.name)}`}
                  </Link>
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={t(`accountTypes.${a.type}`, { defaultValue: a.type })} />
                </TableCell>
                <Pair value={a.opening} money={money} />
                <Pair value={a.period} money={money} />
                <Pair value={a.closing} money={money} warn={a.isUnusual} />
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} sx={{ fontWeight: 700 }}>{t("total")}</TableCell>
              <Pair value={data.totals.opening} money={money} bold />
              <Pair value={data.totals.period} money={money} bold />
              <Pair value={data.totals.closing} money={money} bold />
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
};

/** A debit cell and a credit cell, with a divider before the pair. */
const Pair = ({ value, money, bold, warn }: { value: DebitCredit; money: (minor: number) => string; bold?: boolean; warn?: boolean }) => {
  const sx = { fontWeight: bold ? 700 : warn ? 600 : undefined, color: warn ? "warning.main" : undefined };
  return (
    <>
      <TableCell align="right" sx={{ ...sx, borderInlineStart: 1, borderColor: "divider" }}>{money(value.debitMinor)}</TableCell>
      <TableCell align="right" sx={sx}>{money(value.creditMinor)}</TableCell>
    </>
  );
};

const SalesByProductReport = ({ range }: { range: DayRange }) => {
  const { t } = useTranslation();
  const currency = useCurrency();
  const name = useName();
  const { data, isLoading } = useReportQuery<SalesByProduct>("sales-by-product", range);
  if (isLoading || !data) return <TableLoading />;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  const sum = (key: "units" | "netSalesMinor" | "costMinor" | "marginMinor" | "refundedUnits" | "refundedMinor") => data.rows.reduce((total, r) => total + r[key], 0);
  const uncosted = data.rows.some((r) => r.uncostedUnits > 0);
  return (
    <Stack spacing={2}>
      {uncosted && <Alert severity="warning">{t("uncostedSales")}</Alert>}
      <Grid
        head={[t("product"), t("units"), t("netSales"), t("cost"), t("margin"), t("refundedUnits"), t("refunded")]}
        rows={data.rows.map((r) => [
          `${name(r.name) || "—"}${r.variantLabel ? ` · ${r.variantLabel}` : ""}`,
          r.uncostedUnits ? `${r.units} (${t("uncostedCount", { count: r.uncostedUnits })})` : r.units,
          money(r.netSalesMinor),
          money(r.costMinor),
          money(r.marginMinor),
          r.refundedUnits,
          money(r.refundedMinor),
        ])}
        total={[t("total"), sum("units"), money(sum("netSalesMinor")), money(sum("costMinor")), money(sum("marginMinor")), sum("refundedUnits"), money(sum("refundedMinor"))]}
      />
    </Stack>
  );
};

export default ReportsPage;
