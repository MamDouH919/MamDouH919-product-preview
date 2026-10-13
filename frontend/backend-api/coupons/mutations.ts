import api from "@/lib/api";
import { Coupon, CouponPayload } from "./types";

export const createCoupon = async (data: CouponPayload): Promise<Coupon> => {
  const response = await api.post("/coupons", data);
  return response.data;
};

export const updateCoupon = async ({
  id,
  data,
}: {
  id: string;
  data: CouponPayload;
}): Promise<Coupon> => {
  const response = await api.patch(`/coupons/${id}`, data);
  return response.data;
};

export const deleteCoupon = async (id: string): Promise<Coupon> => {
  const response = await api.delete(`/coupons/${id}`);
  return response.data;
};
