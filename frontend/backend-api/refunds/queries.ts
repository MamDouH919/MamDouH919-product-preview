import api from "@/lib/api";
import { Refund, RefundBasis, RefundFilters, RefundPreview, RefundRules, RefundsResponse } from "./types";

export const fetchRefunds = async (filters: RefundFilters): Promise<RefundsResponse> => {
  const response = await api.get("/finance/refunds", { params: filters });
  return response.data;
};

export const fetchRefund = async (id: string): Promise<Refund & { rules: RefundRules }> => {
  const response = await api.get(`/finance/refunds/${id}`);
  return response.data;
};

export const fetchRefundPreview = async (basis: RefundBasis): Promise<RefundPreview> => {
  const response = await api.post("/finance/refunds/preview", basis);
  return response.data;
};

export const fetchRefundRules = async (): Promise<RefundRules> => {
  const response = await api.get("/finance/refund-rules");
  return response.data;
};
