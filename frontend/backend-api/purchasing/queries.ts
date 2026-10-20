import api from "@/lib/api";
import { PurchaseDetail, PurchasesResponse, Supplier, SupplierDetail } from "./types";

export const fetchSuppliers = async (): Promise<Supplier[]> => (await api.get("/finance/suppliers")).data;
export const fetchSupplier = async (id: string): Promise<SupplierDetail> => (await api.get(`/finance/suppliers/${id}`)).data;
export const fetchPurchases = async (params: { supplierId?: string; status?: string; page?: number; limit?: number }): Promise<PurchasesResponse> =>
  (await api.get("/finance/purchases", { params })).data;
export const fetchPurchase = async (id: string): Promise<PurchaseDetail> => (await api.get(`/finance/purchases/${id}`)).data;
