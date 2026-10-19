import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { CustomerReturnView, ReturnDetail, ReturnFilters, ReturnRequest, ReturnsResponse } from "./types";

export const fetchMyReturnView = async (orderId: string): Promise<CustomerReturnView> => {
  const response = await customerApi.get(`/returns/me/order/${orderId}`);
  return response.data;
};

export const fetchReturns = async (filters?: ReturnFilters): Promise<ReturnsResponse> => {
  const response = await api.get("/returns", { params: filters });
  return response.data;
};

export const fetchReturn = async (id: string): Promise<ReturnDetail> => {
  const response = await api.get(`/returns/${id}`);
  return response.data;
};

export const fetchOrderReturns = async (orderId: string): Promise<ReturnRequest[]> => {
  const response = await api.get(`/returns/order/${orderId}`);
  return response.data;
};
