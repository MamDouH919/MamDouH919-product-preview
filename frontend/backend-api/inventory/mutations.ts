import api from "@/lib/api";
import {
  AdjustStockPayload,
  StockMovement,
  StockTakePayload,
  StockTransfer,
  TransferPayload,
  Warehouse,
  WarehousePayload,
} from "./types";

export const adjustStock = async (
  data: AdjustStockPayload
): Promise<StockMovement> => {
  const response = await api.post("/inventory/adjust", data);
  return response.data;
};

export const bulkAdjustStock = async (
  items: AdjustStockPayload[]
): Promise<StockMovement[]> => {
  const response = await api.post("/inventory/bulk-adjust", { items });
  return response.data;
};

/** Returns null when the counted quantity already matched. */
export const stockTake = async (
  data: StockTakePayload
): Promise<StockMovement | null> => {
  const response = await api.post("/inventory/stock-take", data);
  return response.data;
};

/** Gives stock with no cost its first one. `unitCost` is a decimal string ("90.00"). */
export const setOpeningCost = async (data: { productId: string; variantId?: string; unitCost: string }) => {
  const response = await api.post("/inventory/opening-cost", data);
  return response.data;
};

/** Fixes an opening cost typed wrong — only while nothing else has touched that stock. */
export const correctOpeningCost = async (data: { productId: string; variantId?: string; unitCost: string }) => {
  const response = await api.post("/inventory/opening-cost/correct", data);
  return response.data;
};

export const createWarehouse = async (data: WarehousePayload): Promise<Warehouse> => {
  const response = await api.post("/warehouses", data);
  return response.data;
};

export const updateWarehouse = async ({ id, ...data }: Partial<WarehousePayload> & { id: string }): Promise<Warehouse> => {
  const response = await api.patch(`/warehouses/${id}`, data);
  return response.data;
};

/** Makes this the warehouse sales take stock from. */
export const setMainWarehouse = async (id: string): Promise<Warehouse> => {
  const response = await api.post(`/warehouses/${id}/main`);
  return response.data;
};

export const deleteWarehouse = async (id: string): Promise<void> => {
  await api.delete(`/warehouses/${id}`);
};

/** Moves units between warehouses in one step. Moves no value. */
export const createTransfer = async (data: TransferPayload): Promise<StockTransfer> => {
  const response = await api.post("/warehouses/transfers", data);
  return response.data;
};
