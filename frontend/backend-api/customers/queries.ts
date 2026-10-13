import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { Address, Customer, CustomerFilters, CustomersResponse } from "./types";
import { Product } from "../products/types";

// ── Customer self-service ─────────────────────────────────────────────────────

export const fetchCustomerProfile = async (): Promise<Customer> => {
  const response = await customerApi.get("/customers/me");
  return response.data;
};

/**
 * Same call, but a 401 is left for the caller to handle. Used when restoring a
 * session on page load, where a dead cookie should be cleared silently rather
 * than redirecting someone who was only browsing.
 */
export const fetchCustomerProfileSilent = async (): Promise<Customer> => {
  const response = await customerApi.get("/customers/me", {
    skipAuthRedirect: true,
  });
  return response.data;
};

export const fetchCustomerAddresses = async (): Promise<Address[]> => {
  const response = await customerApi.get("/customers/me/addresses");
  return response.data;
};

export const fetchWishlist = async (): Promise<Product[]> => {
  const response = await customerApi.get("/customers/me/wishlist");
  return response.data;
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const fetchCustomers = async (
  params?: CustomerFilters
): Promise<CustomersResponse> => {
  const response = await api.get("/customers", { params });
  return response.data;
};

export const fetchCustomerById = async (id: string): Promise<Customer> => {
  const response = await api.get(`/customers/${id}`);
  return response.data;
};
