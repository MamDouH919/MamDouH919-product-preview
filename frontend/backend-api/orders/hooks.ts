import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/Store/store";
import {
  fetchMyOrder,
  fetchMyOrders,
  fetchOrderById,
  fetchOrders,
  fetchQuote,
} from "./queries";
import { OrderFilters, OrderItemInput } from "./types";

export const QUOTE_QUERY_KEY = "order-quote";
export const MY_ORDERS_QUERY_KEY = "my-orders";
export const ORDERS_QUERY_KEY = "orders";

/** Live prices and stock for the basket; refetches whenever its lines change. */
export const useQuoteQuery = (items: OrderItemInput[], couponCode?: string) => {
  return useQuery({
    queryKey: [QUOTE_QUERY_KEY, items, couponCode],
    queryFn: () => fetchQuote(items, couponCode),
    enabled: items.length > 0,
    // Keep showing the last totals while a quantity change re-prices.
    placeholderData: keepPreviousData,
  });
};

export const useMyOrdersQuery = (filters?: OrderFilters) => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  return useQuery({
    queryKey: [MY_ORDERS_QUERY_KEY, filters],
    queryFn: () => fetchMyOrders(filters),
    enabled: isLoggedIn,
  });
};

export const useMyOrderQuery = (id: string) => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  return useQuery({
    queryKey: [MY_ORDERS_QUERY_KEY, id],
    queryFn: () => fetchMyOrder(id),
    enabled: isLoggedIn && !!id,
  });
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const useOrdersQuery = (filters?: OrderFilters) => {
  return useQuery({
    queryKey: [ORDERS_QUERY_KEY, filters],
    queryFn: () => fetchOrders(filters),
  });
};

export const useOrderByIdQuery = (id: string) => {
  return useQuery({
    queryKey: [ORDERS_QUERY_KEY, id],
    queryFn: () => fetchOrderById(id),
    enabled: !!id,
  });
};
