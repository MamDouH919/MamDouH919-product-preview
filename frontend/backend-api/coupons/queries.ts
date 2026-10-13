import api from "@/lib/api";
import { Coupon } from "./types";

export const fetchCoupons = async (search?: string): Promise<Coupon[]> => {
  const response = await api.get("/coupons", { params: { search: search || undefined } });
  return response.data;
};
