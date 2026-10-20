import api from "@/lib/api";
import { OrderFinance } from "./types";

export const fetchOrderFinance = async (orderId: string): Promise<OrderFinance> => {
  const response = await api.get(`/finance/orders/${orderId}`);
  return response.data;
};
