import customerApi from "@/lib/customerApi";
import { CartItem } from "@/Store/slices/cart";

/** The signed-in customer's saved basket, ready to drop into the cart slice. */
export const fetchSavedCart = async (): Promise<{ items: CartItem[] }> => {
  const response = await customerApi.get("/customers/me/cart");
  return response.data;
};

/** Mirrors the basket to the account — what and how many only; prices always come from the server. */
export const saveCart = async (items: CartItem[], locale: string): Promise<void> => {
  await customerApi.put("/customers/me/cart", {
    items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    locale,
  });
};

/** The "stop cart reminders" link from a reminder email. */
export const optOutOfCartReminders = async (token: string): Promise<void> => {
  await customerApi.post("/cart-reminders/opt-out", { token }, { skipAuthRedirect: true });
};
