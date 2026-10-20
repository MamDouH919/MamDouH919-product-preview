import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type MoneyAccountType = "cash" | "bank" | "wallet";

/** A cash box, bank account or wallet. `balanceMinor` in minor units. */
export type MoneyAccount = {
  _id: string;
  name: string;
  type: MoneyAccountType;
  isDefault: boolean;
  isActive: boolean;
  balanceMinor: number;
};

export const MONEY_ACCOUNTS_QUERY_KEY = "money-accounts";

export const fetchMoneyAccounts = async (): Promise<MoneyAccount[]> => (await api.get("/finance/money-accounts")).data;
export const createMoneyAccount = async (data: { name: string; type: MoneyAccountType }) => (await api.post("/finance/money-accounts", data)).data;
export const updateMoneyAccount = async ({ id, ...data }: { id: string; name?: string; isActive?: boolean; isDefault?: boolean }) =>
  (await api.patch(`/finance/money-accounts/${id}`, data)).data;
/** `amount` is a decimal string ("5000.00"). */
export const transferMoney = async (data: { fromId: string; toId: string; amount: string; note?: string }) =>
  (await api.post("/finance/money-accounts/transfers", data)).data;

export const useMoneyAccountsQuery = (enabled = true) =>
  useQuery({ queryKey: [MONEY_ACCOUNTS_QUERY_KEY], queryFn: fetchMoneyAccounts, enabled, retry: false });
