import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { CustomerSession } from "../customers/types";
import {
  CreateGuestOrderPayload,
  CreateOrderPayload,
  GuestOrderResponse,
  Order,
  OrderStatus,
  TrackedOrder,
} from "./types";

export const placeOrder = async (data: CreateOrderPayload): Promise<Order> => {
  const response = await customerApi.post("/orders/me", data);
  return response.data;
};

/** Checkout without an account — the server matches or creates the customer by email. */
export const placeGuestOrder = async (data: CreateGuestOrderPayload): Promise<GuestOrderResponse> => {
  const response = await customerApi.post("/orders/guest", data);
  return response.data;
};

/**
 * Turns a guest order's customer into an account: signs them in when a
 * password is accepted, or emails them an activation link.
 */
export const claimGuestAccount = async ({
  id,
  token,
  password,
}: {
  id: string;
  token: string;
  password?: string;
}): Promise<{ session?: CustomerSession; activationSent?: boolean }> => {
  const response = await customerApi.post(`/orders/guest/${id}/account`, { token, password });
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

/** Public lookup by order number plus the email or phone it was placed with. */
export const trackOrder = async (data: { orderNumber: number; contact: string }): Promise<TrackedOrder> => {
  const response = await customerApi.post("/orders/track", data, { skipAuthRedirect: true });
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
