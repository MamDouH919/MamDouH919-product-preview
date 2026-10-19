import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/Store/store";
import { fetchMyReturnView, fetchOrderReturns, fetchReturn, fetchReturns } from "./queries";
import { ReturnFilters } from "./types";

export const RETURNS_QUERY_KEY = "returns";
export const MY_RETURNS_QUERY_KEY = "my-returns";

export const useMyReturnViewQuery = (orderId: string | undefined) => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);
  return useQuery({
    queryKey: [MY_RETURNS_QUERY_KEY, orderId],
    queryFn: () => fetchMyReturnView(orderId!),
    enabled: isLoggedIn && !!orderId,
  });
};

export const useReturnsQuery = (filters?: ReturnFilters) => {
  return useQuery({
    queryKey: [RETURNS_QUERY_KEY, filters],
    queryFn: () => fetchReturns(filters),
    placeholderData: keepPreviousData,
  });
};

export const useReturnQuery = (id: string) => {
  return useQuery({
    queryKey: [RETURNS_QUERY_KEY, "one", id],
    queryFn: () => fetchReturn(id),
    enabled: !!id,
  });
};

export const useOrderReturnsQuery = (orderId: string | undefined) => {
  return useQuery({
    queryKey: [RETURNS_QUERY_KEY, "order", orderId],
    queryFn: () => fetchOrderReturns(orderId!),
    enabled: !!orderId,
  });
};
