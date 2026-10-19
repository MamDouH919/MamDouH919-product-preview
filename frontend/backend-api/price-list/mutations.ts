import api from "@/lib/api";
import { DeliveryPrice } from "./types";

export const createDeliveryPrice = async (data: {
  subZoneId: string;
  price: number;
  isActive: boolean;
}): Promise<DeliveryPrice> => {
  const response = await api.post("/price-list", data);
  return response.data;
};

/** Prices every subzone of a zone; existing rows take the new price. */
export const setZonePrice = async (data: { zoneId: string; price: number }): Promise<{ updated: number }> => {
  const response = await api.post("/price-list/zone", data);
  return response.data;
};

export const updateDeliveryPrice = async ({
  id,
  data,
}: {
  id: string;
  data: { price?: number; isActive?: boolean };
}): Promise<DeliveryPrice> => {
  const response = await api.patch(`/price-list/${id}`, data);
  return response.data;
};

export const deleteDeliveryPrice = async (id: string): Promise<DeliveryPrice> => {
  const response = await api.delete(`/price-list/${id}`);
  return response.data;
};
