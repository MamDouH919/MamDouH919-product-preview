import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { Order, OrderFilters, OrderItemInput, OrdersResponse, Quote } from "./types";

/** Prices a basket against the live catalogue. Public — works for guests. */
export const fetchQuote = async (items: OrderItemInput[]): Promise<Quote> => {
  const response = await customerApi.post("/orders/quote", { items });
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
