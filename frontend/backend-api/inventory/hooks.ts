import { useQuery } from "@tanstack/react-query";
import {
  fetchInventorySummary,
  fetchLowStock,
  fetchMovementTypes,
  fetchStockLevels,
  fetchStockMovements,
  fetchTransfers,
  fetchWarehouses,
} from "./queries";
import { InventoryFilters, MovementFilters } from "./types";

export const INVENTORY_QUERY_KEY = "inventory";
export const MOVEMENTS_QUERY_KEY = "stock-movements";
export const MOVEMENT_TYPES_QUERY_KEY = "movement-types";
export const WAREHOUSES_QUERY_KEY = "warehouses";
export const TRANSFERS_QUERY_KEY = "stock-transfers";

export const useStockLevelsQuery = (filters?: InventoryFilters) => {
  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, filters],
    queryFn: () => fetchStockLevels(filters),
  });
};

export const useInventorySummaryQuery = () => {
  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, "summary"],
    queryFn: fetchInventorySummary,
  });
};

export const useLowStockQuery = (enabled = true) => {
  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, "low-stock"],
    queryFn: fetchLowStock,
    enabled,
  });
};

/** The type catalogue rarely changes, so it is cached for the session. */
export const useMovementTypesQuery = () => {
  return useQuery({
    queryKey: [MOVEMENT_TYPES_QUERY_KEY],
    queryFn: fetchMovementTypes,
    staleTime: Infinity,
  });
};

export const useStockMovementsQuery = (filters?: MovementFilters) => {
  return useQuery({
    queryKey: [MOVEMENTS_QUERY_KEY, filters],
    queryFn: () => fetchStockMovements(filters),
  });
};

export const useWarehousesQuery = (enabled = true) => {
  return useQuery({
    queryKey: [WAREHOUSES_QUERY_KEY],
    queryFn: fetchWarehouses,
    enabled,
  });
};

export const useTransfersQuery = (filters?: { warehouseId?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: [TRANSFERS_QUERY_KEY, filters],
    queryFn: () => fetchTransfers(filters),
  });
};
