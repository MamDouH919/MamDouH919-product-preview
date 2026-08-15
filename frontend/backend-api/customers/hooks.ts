import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/Store/store";
import {
  fetchCustomerAddresses,
  fetchCustomerById,
  fetchCustomerProfile,
  fetchCustomers,
} from "./queries";
import { CustomerFilters } from "./types";

export const CUSTOMERS_QUERY_KEY = "customers";
export const CUSTOMER_ME_QUERY_KEY = "customer-me";
export const CUSTOMER_ADDRESSES_QUERY_KEY = "customer-addresses";

/** Only runs once a customer session exists, so guests don't fire a 401. */
export const useCustomerProfileQuery = () => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  return useQuery({
    queryKey: [CUSTOMER_ME_QUERY_KEY],
    queryFn: fetchCustomerProfile,
    enabled: isLoggedIn,
  });
};

export const useCustomerAddressesQuery = () => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  return useQuery({
    queryKey: [CUSTOMER_ADDRESSES_QUERY_KEY],
    queryFn: fetchCustomerAddresses,
    enabled: isLoggedIn,
  });
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const useCustomersQuery = (filters?: CustomerFilters) => {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, filters],
    queryFn: () => fetchCustomers(filters),
  });
};

export const useCustomerByIdQuery = (id: string) => {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, id],
    queryFn: () => fetchCustomerById(id),
    enabled: !!id,
  });
};
