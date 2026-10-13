import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/Store/store";
import {
  fetchCustomerAddresses,
  fetchCustomerById,
  fetchCustomerProfile,
  fetchCustomers,
  fetchWishlist,
} from "./queries";
import { CustomerFilters } from "./types";

export const CUSTOMERS_QUERY_KEY = "customers";
export const CUSTOMER_ME_QUERY_KEY = "customer-me";
export const CUSTOMER_ADDRESSES_QUERY_KEY = "customer-addresses";
export const WISHLIST_QUERY_KEY = "wishlist";

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

export const useWishlistQuery = () => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  return useQuery({
    queryKey: [WISHLIST_QUERY_KEY],
    queryFn: fetchWishlist,
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
