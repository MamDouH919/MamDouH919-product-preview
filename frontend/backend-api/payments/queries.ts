import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { GatewayPayouts, GatewaySettings } from "./types";

export const fetchGatewaySettings = async (): Promise<GatewaySettings> => {
  const response = await api.get("/settings/payments");
  return response.data;
};

/** Public: whether checkout may offer online payment (add-on on, gateway set up and switched on). */
export const fetchOnlinePaymentAvailable = async (): Promise<boolean> => {
  try {
    const response = await customerApi.get("/online-payments/available", { skipAuthRedirect: true });
    return !!response.data?.online;
  } catch {
    // The add-on is off for this store (the route answers 404): cash only.
    return false;
  }
};

export const fetchGatewayPayouts = async (): Promise<GatewayPayouts> => {
  const response = await api.get("/online-payments/payouts");
  return response.data;
};
