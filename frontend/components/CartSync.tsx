"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { CartItem, hydrateCart } from "@/Store/slices/cart";

// localStorage is per origin, and every tenant has its own host — so each
// storefront keeps its own cart without any tenant key in the name.
const STORAGE_KEY = "cart";

const readCart = (): CartItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((i) => i && typeof i.productId === "string" && i.quantity > 0)
      : [];
  } catch {
    return [];
  }
};

/** Loads the saved cart once, then saves it after every change. */
const CartSync = () => {
  const dispatch = useAppDispatch();
  const { items, hydrated } = useAppSelector((state) => state.cart);

  useEffect(() => {
    dispatch(hydrateCart(readCart()));
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Private mode or full storage — the cart still works for this visit.
    }
  }, [items, hydrated]);

  return null;
};

export default CartSync;
