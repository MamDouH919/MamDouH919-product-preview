import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchPurchase, fetchPurchases, fetchSupplier, fetchSuppliers } from "./queries";

export const SUPPLIERS_QUERY_KEY = "suppliers";
export const PURCHASES_QUERY_KEY = "purchases";

export const useSuppliersQuery = () => useQuery({ queryKey: [SUPPLIERS_QUERY_KEY], queryFn: fetchSuppliers });
export const useSupplierQuery = (id: string | null) =>
  useQuery({ queryKey: [SUPPLIERS_QUERY_KEY, id], queryFn: () => fetchSupplier(id!), enabled: !!id });
export const usePurchasesQuery = (params: { supplierId?: string; status?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: [PURCHASES_QUERY_KEY, params], queryFn: () => fetchPurchases(params), placeholderData: keepPreviousData });
export const usePurchaseQuery = (id: string) =>
  useQuery({ queryKey: [PURCHASES_QUERY_KEY, "one", id], queryFn: () => fetchPurchase(id), enabled: !!id });
