import { useQuery } from "@tanstack/react-query";
import { fetchOrderFinance } from "./queries";

export const ORDER_FINANCE_QUERY_KEY = "order-finance";

export const useOrderFinanceQuery = (orderId: string) => {
  return useQuery({
    queryKey: [ORDER_FINANCE_QUERY_KEY, orderId],
    queryFn: () => fetchOrderFinance(orderId),
    enabled: !!orderId,
  });
};
