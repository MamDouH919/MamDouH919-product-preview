import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { downloadFile } from "@/utils/downloadFile";

/** All amounts are minor units; `from`/`to` are calendar days (YYYY-MM-DD) in the store's time zone. */
export type DayRange = { from?: string; to?: string };
export type AccountName = { en: string; ar: string };
export type AgeBucket = "0_7" | "8_30" | "31_60" | "61_plus";
export const AGE_BUCKETS: AgeBucket[] = ["0_7", "8_30", "31_60", "61_plus"];

export type StatementLine = { code: string; name: AccountName; type: string; amountMinor: number; previousMinor?: number };

/** The headline figures for a period, as the dashboard reports them. */
export type PeriodTotals = {
  grossProductSalesMinor: number;
  discountsMinor: number;
  productReturnsMinor: number;
  netProductSalesMinor: number;
  deliveryIncomeMinor: number;
  netRevenueMinor: number;
  costOfSalesMinor: number;
  grossProfitMinor: number;
  deliveryCostsMinor: number;
  contributionMinor: number;
  operatingExpensesMinor: number;
  netProfitMinor: number;
};

export type ProfitAndLoss = {
  from?: string;
  to?: string;
  previousStart?: string;
  revenue: StatementLine[];
  costOfSales: StatementLine[];
  expenses: StatementLine[];
  totals: PeriodTotals;
  previousTotals?: PeriodTotals;
};

export type CashFlow = {
  lines: { key: string; name?: AccountName; amountMinor: number }[];
  inflowMinor: number;
  outflowMinor: number;
  netMinor: number;
  openingMinor: number;
  closingMinor: number;
  accounts: { _id: string; name: string; type: string; openingMinor: number; closingMinor: number }[];
};

export type Receivables = {
  asOf: string;
  totalMinor: number;
  buckets: Record<AgeBucket, number>;
  rows: { orderId: string; orderNumber: number; customer: string; phone: string; deliveredAt: string; totalMinor: number; collectedMinor: number; owedMinor: number; days: number; bucket: AgeBucket }[];
};

export type Payables = {
  asOf: string;
  totalMinor: number;
  buckets: Record<AgeBucket, number>;
  rows: { purchaseId: string; purchaseNumber: number; supplier?: string; supplierInvoiceNo?: string; date: string; dueDate?: string; totalMinor: number; owedMinor: number; days: number; overdueDays: number; bucket: AgeBucket }[];
};

export type TrialBalance = {
  asOf?: string;
  accounts: { code: string; name: AccountName; type: string; debitMinor: number; creditMinor: number; balanceMinor: number }[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  balanced: boolean;
};

export type SalesByProduct = {
  rows: {
    productId: string;
    variantId?: string;
    name: Partial<AccountName>;
    variantLabel?: string;
    units: number;
    netSalesMinor: number;
    costMinor: number;
    marginMinor: number;
    uncostedUnits: number;
    refundedUnits: number;
    refundedMinor: number;
  }[];
};

export type InventoryValuation = {
  rows: { productId: string; variantId?: string; name: Partial<AccountName>; variantLabel?: string; sku?: string; stock: number; valued: boolean; valueMinor: number | null; unitCostMinor: number | null }[];
  totalValueMinor: number;
  totalUnits: number;
  uncosted: { productId: string; name: Partial<AccountName>; variantLabel?: string; stock: number }[];
};

export type ReconciliationReport = { ok: boolean; checkedAt: string; checks: { name: string; ok: boolean; detail: string; offenders: string[] }[] };

export type Periods = {
  timeZone: string;
  booksStartedAt?: string;
  lockedThroughDay: string | null;
  history: { from: string | null; to: string | null | { day: string | null; reason: string }; by?: string; at: string }[];
};

export const REPORTS = ["profit-and-loss", "cash-flow", "receivables", "payables", "trial-balance", "sales-by-product"] as const;
export type Report = (typeof REPORTS)[number];

export const STATEMENTS_QUERY_KEY = "statements";
export const PERIODS_QUERY_KEY = "finance-periods";
export const RECONCILIATION_QUERY_KEY = "finance-reconciliation";

const fetchReport = async <T,>(report: Report, range: DayRange): Promise<T> => (await api.get(`/finance/reports/${report}`, { params: range })).data;

/** The same report as a spreadsheet, with account and product names in `lang`. */
export const downloadReportCsv = async (report: Report, range: DayRange, lang: string) => {
  const response = await api.get(`/finance/reports/${report}`, { params: { ...range, format: "csv", lang: lang === "ar" ? "ar" : "en" }, responseType: "blob" });
  const span = [range.from, range.to].filter(Boolean).join("_to_");
  downloadFile(response.data, `${report}${span ? `-${span}` : ""}.csv`);
};

export const useReportQuery = <T,>(report: Report, range: DayRange, enabled = true) =>
  useQuery({ queryKey: [STATEMENTS_QUERY_KEY, report, range], queryFn: () => fetchReport<T>(report, range), enabled, placeholderData: keepPreviousData });

export const useInventoryValuationQuery = (enabled = true) =>
  useQuery({ queryKey: [STATEMENTS_QUERY_KEY, "valuation"], queryFn: async (): Promise<InventoryValuation> => (await api.get("/inventory/valuation")).data, enabled });

export const useReconciliationQuery = () =>
  useQuery({ queryKey: [RECONCILIATION_QUERY_KEY], queryFn: async (): Promise<ReconciliationReport> => (await api.get("/finance/reconciliation")).data });

export const usePeriodsQuery = () => useQuery({ queryKey: [PERIODS_QUERY_KEY], queryFn: async (): Promise<Periods> => (await api.get("/finance/periods")).data });

export const lockPeriod = async (through: string): Promise<Periods> => (await api.post("/finance/periods/lock", { through })).data;
export const reopenPeriod = async (data: { through?: string; reason: string }): Promise<Periods> => (await api.post("/finance/periods/reopen", data)).data;
