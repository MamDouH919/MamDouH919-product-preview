import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { DeliveryArea, DeliveryPrice, DeliveryPriceFilters, Zone } from "./types";

export const fetchZones = async (): Promise<Zone[]> => {
  const response = await api.get("/price-list/zones");
  return response.data;
};

export const fetchDeliveryPrices = async (filters?: DeliveryPriceFilters): Promise<DeliveryPrice[]> => {
  const response = await api.get("/price-list", {
    params: { zone: filters?.zone || undefined, search: filters?.search || undefined },
  });
  return response.data;
};

/** Public — where the store delivers, for checkout and the address book. */
export const fetchDeliveryAreas = async (): Promise<DeliveryArea[]> => {
  const response = await customerApi.get("/delivery-areas");
  return response.data;
};
