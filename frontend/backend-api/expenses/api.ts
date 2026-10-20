import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Expense, ExpensesResponse } from "./types";

export const EXPENSES_QUERY_KEY = "expenses";

export type ExpenseFilters = { from?: string; to?: string; account?: string; page?: number; limit?: number };

export const fetchExpenses = async (filters: ExpenseFilters): Promise<ExpensesResponse> => (await api.get("/finance/expenses", { params: filters })).data;

/** `amount` is a decimal string ("3000.00"). */
export const createExpense = async (data: { account: string; amount: string; date?: string; description: string; reference?: string; orderId?: string; moneyAccountId?: string }): Promise<Expense> =>
  (await api.post("/finance/expenses", data)).data;

export const reverseExpense = async ({ id, reason }: { id: string; reason: string }): Promise<Expense> =>
  (await api.post(`/finance/expenses/${id}/reverse`, { reason })).data;

export const useExpensesQuery = (filters: ExpenseFilters) =>
  useQuery({ queryKey: [EXPENSES_QUERY_KEY, filters], queryFn: () => fetchExpenses(filters), placeholderData: keepPreviousData });
