import api from "@/lib/api";
import { CreateRefundPayload, DeliveryFeeRefundPolicy, Refund, RefundRules } from "./types";

export const requestRefund = async (payload: CreateRefundPayload): Promise<Refund> => {
  const response = await api.post("/finance/refunds", payload);
  return response.data;
};

export const approveRefund = async ({ id, note }: { id: string; note?: string }): Promise<Refund> => {
  const response = await api.patch(`/finance/refunds/${id}/approve`, { note });
  return response.data;
};

export const rejectRefund = async ({ id, note }: { id: string; note?: string }): Promise<Refund> => {
  const response = await api.patch(`/finance/refunds/${id}/reject`, { note });
  return response.data;
};

export const executeRefund = async (id: string): Promise<Refund> => {
  const response = await api.post(`/finance/refunds/${id}/execute`);
  return response.data;
};

export const reverseRefund = async ({ id, reason }: { id: string; reason: string }): Promise<Refund> => {
  const response = await api.post(`/finance/refunds/${id}/reverse`, { reason });
  return response.data;
};

export const updateRefundRules = async (payload: {
  autoApproveUpTo?: string;
  singleApproverUpTo?: string;
  deliveryFeeRefund?: DeliveryFeeRefundPolicy;
}): Promise<RefundRules> => {
  const response = await api.patch("/finance/refund-rules", payload);
  return response.data;
};
