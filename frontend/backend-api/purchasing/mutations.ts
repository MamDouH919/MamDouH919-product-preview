import api from "@/lib/api";
import { Purchase, PurchaseInput, Supplier, SupplierInput } from "./types";

export const createSupplier = async (data: SupplierInput): Promise<Supplier> => (await api.post("/finance/suppliers", data)).data;
export const updateSupplier = async ({ id, ...data }: SupplierInput & { id: string }): Promise<Supplier> =>
  (await api.patch(`/finance/suppliers/${id}`, data)).data;

export const createPurchase = async (data: PurchaseInput): Promise<Purchase> => (await api.post("/finance/purchases", data)).data;
export const updatePurchase = async ({ id, ...data }: Partial<PurchaseInput> & { id: string }): Promise<Purchase> =>
  (await api.patch(`/finance/purchases/${id}`, data)).data;
export const deletePurchase = async (id: string) => (await api.delete(`/finance/purchases/${id}`)).data;
/** Receives the goods into stock and records what the supplier is owed. */
export const postPurchase = async (id: string): Promise<Purchase> => (await api.post(`/finance/purchases/${id}/post`)).data;

export const returnToSupplier = async (data: { purchaseId: string; lines: { lineIndex: number; quantity: number }[]; note?: string }) =>
  (await api.post("/finance/purchase-returns", data)).data;

export const paySupplier = async (data: { supplierId: string; amount: string; date?: string; moneyAccountId?: string; note?: string }) =>
  (await api.post("/finance/supplier-payments", data)).data;
