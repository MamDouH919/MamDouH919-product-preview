import { useQuery } from "@tanstack/react-query";
import {
  fetchInventorySummary,
  fetchLowStock,
  fetchMovementTypes,
  fetchStockLevels,
  fetchStockMovements,
} from "./queries";
import { InventoryFilters, MovementFilters } from "./types";

export const INVENTORY_QUERY_KEY = "inventory";
export const MOVEMENTS_QUERY_KEY = "stock-movements";
export const MOVEMENT_TYPES_QUERY_KEY = "movement-types";

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

export const useLowStockQuery = () => {
  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, "low-stock"],
    queryFn: fetchLowStock,
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
