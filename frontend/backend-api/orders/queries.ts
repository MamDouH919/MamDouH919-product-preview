import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { GuestOrder, Order, OrderFilters, OrderItemInput, OrdersResponse, Quote } from "./types";

/** Prices a basket against the live catalogue. Public — works for guests. */
export const fetchQuote = async (
  items: OrderItemInput[],
  couponCode?: string,
  subZoneId?: string
): Promise<Quote> => {
  const response = await customerApi.post("/orders/quote", {
    items,
    couponCode: couponCode || undefined,
    subZoneId: subZoneId || undefined,
  });
  return response.data;
};

/** A guest order, opened with the token from its confirmation link. */
export const fetchGuestOrder = async (id: string, token: string): Promise<GuestOrder> => {
  const response = await customerApi.post(`/orders/guest/${id}`, { token });
  return response.data;
};

// ── Customer ──────────────────────────────────────────────────────────────────

export const fetchMyOrders = async (params?: OrderFilters): Promise<OrdersResponse> => {
  const response = await customerApi.get("/orders/me", { params });
  return response.data;
};

export const fetchMyOrder = async (id: string): Promise<Order> => {
  const response = await customerApi.get(`/orders/me/${id}`);
  return response.data;
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const fetchOrders = async (params?: OrderFilters): Promise<OrdersResponse> => {
  const response = await api.get("/orders", { params });
  return response.data;
};

export const fetchOrderById = async (id: string): Promise<Order> => {
  const response = await api.get(`/orders/${id}`);
  return response.data;
};

/** Every order matching the filters as CSV (not just the page on screen). */
export const exportOrdersCsv = async (
  filters: Pick<OrderFilters, "status" | "search" | "from" | "to">,
  lang: string
): Promise<Blob> => {
  const response = await api.get("/orders/export", {
    params: { ...filters, lang: lang === "ar" ? "ar" : "en" },
    responseType: "blob",
  });
  return response.data;
};
