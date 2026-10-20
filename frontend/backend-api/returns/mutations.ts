import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { CreateReturnPayload, ReturnRequest } from "./types";

export const requestReturn = async (data: CreateReturnPayload): Promise<ReturnRequest> => {
  const response = await customerApi.post("/returns/me", data);
  return response.data;
};

// ── Admin ──

export const createStoreReturn = async (data: CreateReturnPayload): Promise<ReturnRequest> => {
  const response = await api.post("/returns", data);
  return response.data;
};

export const approveReturn = async ({ id, note }: { id: string; note?: string }): Promise<ReturnRequest> => {
  const response = await api.patch(`/returns/${id}/approve`, { note });
  return response.data;
};

export const rejectReturn = async ({ id, note }: { id: string; note?: string }): Promise<ReturnRequest> => {
  const response = await api.patch(`/returns/${id}/reject`, { note });
  return response.data;
};

// Refunding a return goes through `requestRefund` (backend-api/refunds) with its `returnId`.
