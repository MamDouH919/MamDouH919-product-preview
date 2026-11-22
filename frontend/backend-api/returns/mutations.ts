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

export const receiveReturn = async ({ id, note }: { id: string; note?: string }): Promise<ReturnRequest> => {
  const response = await api.patch(`/returns/${id}/receive`, { note });
  return response.data;
};

export const rejectReturn = async ({ id, note }: { id: string; note?: string }): Promise<ReturnRequest> => {
  const response = await api.patch(`/returns/${id}/reject`, { note });
  return response.data;
};

export type SettleReturnPayload = {
  id: string;
  /** Money given back, in the store currency. */
  refundAmount: number;
  /** Order line indexes to put back on the shelf. */
  restockLines: number[];
  note?: string;
};

/** Closes a return in a store with stock but no books: records the money back and restocks. */
export const settleReturn = async ({ id, ...body }: SettleReturnPayload): Promise<ReturnRequest> => {
  const response = await api.patch(`/returns/${id}/settle`, body);
  return response.data;
};

// In a store with books, refunding a return goes through `requestRefund` (backend-api/refunds) with its `returnId`.
