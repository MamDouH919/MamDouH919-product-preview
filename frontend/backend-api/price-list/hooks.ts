import { useQuery } from "@tanstack/react-query";
import { fetchDeliveryAreas, fetchDeliveryPrices, fetchZones } from "./queries";
import { DeliveryPriceFilters } from "./types";

export const PRICE_LIST_QUERY_KEY = "price-list";
export const ZONES_QUERY_KEY = "price-list-zones";
export const DELIVERY_AREAS_QUERY_KEY = "delivery-areas";

export const useDeliveryPricesQuery = (filters?: DeliveryPriceFilters) => {
  return useQuery({
    queryKey: [PRICE_LIST_QUERY_KEY, filters],
    queryFn: () => fetchDeliveryPrices(filters),
  });
};

export const useZonesQuery = () => {
  return useQuery({
    queryKey: [ZONES_QUERY_KEY],
    queryFn: fetchZones,
    staleTime: 5 * 60_000,
  });
};

export const useDeliveryAreasQuery = () => {
  return useQuery({
    queryKey: [DELIVERY_AREAS_QUERY_KEY],
    queryFn: fetchDeliveryAreas,
  });
};
