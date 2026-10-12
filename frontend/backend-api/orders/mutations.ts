import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { CreateOrderPayload, Order, OrderStatus } from "./types";

export const placeOrder = async (data: CreateOrderPayload): Promise<Order> => {
  const response = await customerApi.post("/orders/me", data);
  return response.data;
};

export const cancelMyOrder = async ({
  id,
  reason,
}: {
  id: string;
  reason?: string;
}): Promise<Order> => {
  const response = await customerApi.post(`/orders/me/${id}/cancel`, { reason });
  return response.data;
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const updateOrderStatus = async ({
  id,
  status,
  note,
}: {
  id: string;
  status: OrderStatus;
  note?: string;
}): Promise<Order> => {
  const response = await api.patch(`/orders/${id}/status`, { status, note });
  return response.data;
};
