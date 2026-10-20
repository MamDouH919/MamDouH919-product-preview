import api from "@/lib/api";
import { Custody, Payment } from "./types";

/** `amount` is a decimal string ("315.00") so no float ever carries money. */
export const recordCollection = async ({
  orderId,
  amount,
  custody,
  courierId,
  moneyAccountId,
  note,
}: {
  orderId: string;
  amount: string;
  custody: Custody;
  /** Required when a courier holds the cash, so they can settle it. */
  courierId?: string;
  /** Where staff put it; the default account when left out. */
  moneyAccountId?: string;
  note?: string;
}): Promise<Payment> => {
  const response = await api.post(`/finance/orders/${orderId}/collections`, { amount, custody, courierId, moneyAccountId, note: note || undefined });
  return response.data;
};

/** Writes off what the customer will never pay. Without `amount`, everything still owed. */
export const writeOffBalance = async ({ orderId, amount, reason }: { orderId: string; amount?: string; reason: string }) =>
  (await api.post(`/finance/orders/${orderId}/write-off`, { amount, reason })).data;

export const voidCollection = async ({ paymentId, reason }: { paymentId: string; reason: string }): Promise<Payment> => {
  const response = await api.post(`/finance/payments/${paymentId}/void`, { reason });
  return response.data;
};
