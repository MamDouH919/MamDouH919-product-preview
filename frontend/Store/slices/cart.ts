import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { LocalizedField } from "@/backend-api/globalTypes";

/**
 * A basket line. Name, image and price are a display snapshot from when it was
 * added — the cart page re-prices everything through `/orders/quote`, and the
 * server never takes a price from the client.
 */
export type CartItem = {
  productId: string;
  variantId?: string;
  quantity: number;
  name: LocalizedField;
  variantLabel?: string;
  image?: string;
  slug: string;
  price?: number;
};

export interface CartState {
  items: CartItem[];
  /** False until the saved cart has been read, so it isn't overwritten with []. */
  hydrated: boolean;
}

const initialState: CartState = { items: [], hydrated: false };

const sameLine = (a: { productId: string; variantId?: string }, b: { productId: string; variantId?: string }) =>
  a.productId === b.productId && (a.variantId ?? "") === (b.variantId ?? "");

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    hydrateCart: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload;
      state.hydrated = true;
    },
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existing = state.items.find((i) => sameLine(i, action.payload));
      if (existing) {
        existing.quantity += action.payload.quantity;
        // Refresh the display snapshot with whatever the shopper just saw.
        Object.assign(existing, { ...action.payload, quantity: existing.quantity });
      } else {
        state.items.push(action.payload);
      }
    },
    setCartQuantity: (
      state,
      action: PayloadAction<{ productId: string; variantId?: string; quantity: number }>
    ) => {
      const item = state.items.find((i) => sameLine(i, action.payload));
      if (!item) return;
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((i) => !sameLine(i, action.payload));
      } else {
        item.quantity = action.payload.quantity;
      }
    },
    removeFromCart: (state, action: PayloadAction<{ productId: string; variantId?: string }>) => {
      state.items = state.items.filter((i) => !sameLine(i, action.payload));
    },
    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const { hydrateCart, addToCart, setCartQuantity, removeFromCart, clearCart } =
  cartSlice.actions;

export const selectCartCount = (state: RootState) =>
  state.cart.items.reduce((sum, i) => sum + i.quantity, 0);

export default cartSlice.reducer;
