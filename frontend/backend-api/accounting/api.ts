import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { downloadFile } from "@/utils/downloadFile";
import type { AccountName, BalanceSide } from "@/backend-api/statements/api";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "contra_revenue" | "cost_of_sales" | "expense";
export type AccountCategory = "assets" | "liabilities" | "equity" | "revenue" | "expenses";
export type CashFlowActivity = "operating" | "investing" | "financing";

export const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "contra_revenue", "cost_of_sales", "expense"];
export const ACCOUNT_CATEGORIES: AccountCategory[] = ["assets", "liabilities", "equity", "revenue", "expenses"];
export const CASH_FLOW_ACTIVITIES: CashFlowActivity[] = ["operating", "investing", "financing"];
/** The books' cash account; banks and wallets are money accounts inside it. */
export const CASH_ACCOUNT = "1000";

/** One account in the chart, with its all-time totals. Amounts in minor units. */
export type ChartAccount = {
  code: string;
  name: AccountName;
  type: AccountType;
  category: AccountCategory;
  normalSide: BalanceSide;
  cashFlowActivity: CashFlowActivity;
  isSystem: boolean;
  isActive: boolean;
  allowsManual: boolean;
  description?: string;
  debitMinor: number;
  creditMinor: number;
  entries: number;
  balanceMinor: number;
  side: BalanceSide;
  isUnusual: boolean;
};

export type JournalSource = { type: string; id: string; number?: number; event: string };

export type JournalEntry = {
  _id: string;
  entryNumber: number;
  date: string;
  postedAt: string;
  source: JournalSource;
  /** In both languages: system memos are written in each, staff-typed ones hold the same text twice. */
  memo?: AccountName;
  isManual: boolean;
  isReversal: boolean;
  isReversed: boolean;
  reversalOf?: string;
  reversedBy?: { _id: string; entryNumber: number };
  createdBy?: { _id: string; name: string };
  totalMinor: number;
  lines: {
    account: string;
    name: AccountName;
    type?: AccountType;
    debitMinor: number;
    creditMinor: number;
    note?: string;
    order?: string;
    moneyAccount?: { _id: string; name?: string };
  }[];
};

export type JournalPage = { page: number; limit: number; total: number; rows: JournalEntry[] };

export type JournalFilters = { from?: string; to?: string; account?: string; source?: string; search?: string; page?: number; limit?: number };

export type AccountStatement = {
  account: Omit<ChartAccount, "debitMinor" | "creditMinor" | "entries" | "balanceMinor" | "side" | "isUnusual">;
  from?: string;
  to?: string;
  /** Signed for the account's nature: positive is its normal side. */
  openingMinor: number;
  debitMinor: number;
  creditMinor: number;
  closingMinor: number;
  truncated: boolean;
  rows: {
    entryId: string;
    entryNumber: number;
    date: string;
    source: JournalSource;
    memo?: AccountName;
    note?: string;
    moneyAccount?: string;
    counterparts: { code: string; name: AccountName }[];
    debitMinor: number;
    creditMinor: number;
    balanceMinor: number;
  }[];
};

export type StatementFilters = { from?: string; to?: string; moneyAccount?: string };

/** A line as typed: amounts are decimal strings ("1500.00"); one of debit or credit. */
export type ManualLineInput = { account: string; debit?: string; credit?: string; moneyAccountId?: string; note?: string };
export type ManualEntryInput = { date: string; memo: string; reference?: string; lines: ManualLineInput[] };

export const CHART_QUERY_KEY = "chart-of-accounts";
export const JOURNAL_QUERY_KEY = "journal";
export const ACCOUNT_STATEMENT_QUERY_KEY = "account-statement";

/** Everything a posting changes: the chart's balances, the journal, statements and reports. */
export const ACCOUNTING_QUERY_KEYS = [CHART_QUERY_KEY, JOURNAL_QUERY_KEY, ACCOUNT_STATEMENT_QUERY_KEY, "statements", "money-accounts", "finance-reconciliation"];

export const useChartQuery = (enabled = true) =>
  useQuery({ queryKey: [CHART_QUERY_KEY], queryFn: async (): Promise<ChartAccount[]> => (await api.get("/finance/accounts")).data, enabled });

export const fetchNextCode = async (type: AccountType): Promise<string> => (await api.get("/finance/accounts/next-code", { params: { type } })).data.code;

export const createAccount = async (data: { code: string; name: AccountName; type: AccountType; cashFlowActivity?: CashFlowActivity; description?: string }) =>
  (await api.post("/finance/accounts", data)).data;

export const updateAccount = async ({ code, ...data }: { code: string; name?: AccountName; cashFlowActivity?: CashFlowActivity; description?: string; isActive?: boolean }) =>
  (await api.patch(`/finance/accounts/${code}`, data)).data;

export const useJournalQuery = (filters: JournalFilters) =>
  useQuery({
    queryKey: [JOURNAL_QUERY_KEY, filters],
    queryFn: async (): Promise<JournalPage> => (await api.get("/finance/journal", { params: filters })).data,
    placeholderData: keepPreviousData,
  });

export const useJournalEntryQuery = (id?: string) =>
  useQuery({
    queryKey: [JOURNAL_QUERY_KEY, "entry", id],
    queryFn: async (): Promise<JournalEntry> => (await api.get(`/finance/journal/${id}`)).data,
    enabled: !!id,
  });

export const createManualEntry = async (data: ManualEntryInput): Promise<JournalEntry> => (await api.post("/finance/journal", data)).data;

export const reverseEntry = async ({ id, ...data }: { id: string; reason: string; date?: string }) => (await api.post(`/finance/journal/${id}/reverse`, data)).data;

export const useAccountStatementQuery = (code: string | undefined, filters: StatementFilters) =>
  useQuery({
    queryKey: [ACCOUNT_STATEMENT_QUERY_KEY, code, filters],
    queryFn: async (): Promise<AccountStatement> => (await api.get(`/finance/accounts/${code}/statement`, { params: filters })).data,
    enabled: !!code,
    placeholderData: keepPreviousData,
  });

export const downloadAccountStatementCsv = async (code: string, filters: StatementFilters, lang: string) => {
  const response = await api.get(`/finance/accounts/${code}/statement`, { params: { ...filters, format: "csv", lang: lang === "ar" ? "ar" : "en" }, responseType: "blob" });
  const span = [filters.from, filters.to].filter(Boolean).join("_to_");
  downloadFile(response.data, `statement-${code}${span ? `-${span}` : ""}.csv`);
};
