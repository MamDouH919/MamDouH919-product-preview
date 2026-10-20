/** Expense categories are account codes; the labels live in the translations (`expenseAccount.<code>`). */
export const EXPENSE_ACCOUNTS = ["6000", "6100", "6200", "6300", "6400", "6500", "6600", "6700"] as const;
export type ExpenseAccount = (typeof EXPENSE_ACCOUNTS)[number];

export type Expense = {
  _id: string;
  expenseNumber: number;
  date: string;
  account: ExpenseAccount;
  /** Minor units. */
  amountMinor: number;
  description: string;
  reference?: string;
  order?: string;
  orderNumber?: number;
  status: "posted" | "reversed";
  createdBy?: { name: string } | string;
  reverseReason?: string;
};

export type ExpensesResponse = {
  data: Expense[];
  total: number;
  page: number;
  limit: number;
  totalsByAccount: Partial<Record<ExpenseAccount, number>>;
};
