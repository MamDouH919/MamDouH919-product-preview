import api from "@/lib/api";
import { AdjustStockPayload, StockMovement, StockTakePayload } from "./types";

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
