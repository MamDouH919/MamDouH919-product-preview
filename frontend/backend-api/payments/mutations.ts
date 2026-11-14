import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { GatewayPayout, GatewaySettings, RecordPayoutInput, UpdateGatewayInput } from "./types";

export const updateGatewaySettings = async (data: UpdateGatewayInput): Promise<GatewaySettings> => {
  const response = await api.patch("/settings/payments", data);
  return response.data;
};

/** Opens a throwaway checkout with the given (possibly unsaved) keys to prove they work. */
export const testGatewaySettings = async (data: Pick<UpdateGatewayInput, "provider" | "credentials">): Promise<{ ok: true }> => {
  const response = await api.post("/settings/payments/test", data);
  return response.data;
};

/** A new payment attempt for the customer's own unpaid online order. */
export const payMyOrder = async (id: string): Promise<{ paymentUrl: string }> => {
  const response = await customerApi.post(`/orders/me/${id}/pay`);
  return response.data;
};

/** Asks the gateway whether the customer's own order was paid — for a confirmation that is late. */
export const syncMyOrderPayment = async (id: string): Promise<{ ok: true }> => {
  const response = await customerApi.post(`/orders/me/${id}/pay/sync`);
  return response.data;
};

export const syncGuestOrderPayment = async ({ id, token }: { id: string; token: string }): Promise<{ ok: true }> => {
  const response = await customerApi.post(`/orders/guest/${id}/pay/sync`, { token });
  return response.data;
};

/** The same for a guest order, with the token it was issued. */
export const payGuestOrder = async ({ id, token }: { id: string; token: string }): Promise<{ paymentUrl: string }> => {
  const response = await customerApi.post(`/orders/guest/${id}/pay`, { token });
  return response.data;
};

export const recordGatewayPayout = async (data: RecordPayoutInput): Promise<GatewayPayout> => {
  const response = await api.post("/online-payments/payouts", data);
  return response.data;
};

export const reverseGatewayPayout = async ({ id, reason }: { id: string; reason: string }): Promise<GatewayPayout> => {
  const response = await api.post(`/online-payments/payouts/${id}/reverse`, { reason });
  return response.data;
};
