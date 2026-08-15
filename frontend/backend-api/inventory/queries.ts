import api from "@/lib/api";
import {
  InventoryFilters,
  InventorySummary,
  MovementFilters,
  MovementTypeInfo,
  MovementsResponse,
  StockLevel,
} from "./types";

export const fetchStockLevels = async (
  params?: InventoryFilters
): Promise<StockLevel[]> => {
  const response = await api.get("/inventory", { params });
  return response.data;
};

export const fetchInventorySummary = async (): Promise<InventorySummary> => {
  const response = await api.get("/inventory/summary");
  return response.data;
};

export const fetchLowStock = async (): Promise<StockLevel[]> => {
  const response = await api.get("/inventory/low-stock");
  return response.data;
};

export const fetchMovementTypes = async (): Promise<MovementTypeInfo[]> => {
  const response = await api.get("/inventory/movement-types");
  return response.data;
};

export const fetchStockMovements = async (
  params?: MovementFilters
): Promise<MovementsResponse> => {
  const response = await api.get("/inventory/movements", { params });
  return response.data;
};
