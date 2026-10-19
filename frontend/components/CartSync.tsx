"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { CartItem, hydrateCart } from "@/Store/slices/cart";
import { fetchSavedCart, saveCart } from "@/backend-api/cart/queries";

// localStorage is per origin, and every tenant has its own host — so each
// storefront keeps its own cart without any tenant key in the name.
const STORAGE_KEY = "cart";
const COUPON_KEY = "cart-coupon";
/** Quantity steppers fire per click; one save after the clicking stops is enough. */
const SAVE_DELAY_MS = 1500;

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

/**
 * Loads the saved cart once, then saves it after every change. For a
 * signed-in customer the cart is also mirrored to their account, so it
 * follows them to another device and an abandoned one can be followed up.
 */
const CartSync = () => {
  const dispatch = useAppDispatch();
  const { i18n } = useTranslation();
  const { items, couponCode, hydrated } = useAppSelector((state) => state.cart);
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);
  // Pushing is held back until this sign-in's saved cart has been read —
  // otherwise an empty cart on a new device would wipe the saved one.
  const serverReady = useRef(false);
  const latestItems = useRef(items);
  latestItems.current = items;

  useEffect(() => {
    let saved: string | undefined;
    try {
      saved = localStorage.getItem(COUPON_KEY) ?? undefined;
    } catch {
      saved = undefined;
    }
    dispatch(hydrateCart({ items: readCart(), couponCode: saved }));
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      if (couponCode) localStorage.setItem(COUPON_KEY, couponCode);
      else localStorage.removeItem(COUPON_KEY);
    } catch {
      // Private mode or full storage — the cart still works for this visit.
    }
  }, [items, couponCode, hydrated]);

  // On sign-in: an empty cart here picks up the one saved on the account; a
  // non-empty one wins and is pushed by the effect below.
  useEffect(() => {
    if (!isLoggedIn) {
      serverReady.current = false;
      return;
    }
    if (!hydrated || serverReady.current) return;

    let cancelled = false;
    fetchSavedCart()
      .then((saved) => {
        if (cancelled) return;
        serverReady.current = true;
        if (latestItems.current.length === 0 && saved.items.length > 0) {
          dispatch(hydrateCart({ items: saved.items, couponCode }));
        } else if (latestItems.current.length > 0) {
          saveCart(latestItems.current, i18n.language).catch(() => null);
        }
      })
      .catch(() => {
        // Couldn't read it; carry on and let this device's cart be the saved one.
        if (!cancelled) serverReady.current = true;
      });
    return () => {
      cancelled = true;
    };
    // Runs once per sign-in; the cart is read through a ref so it's current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, hydrated, dispatch]);

  useEffect(() => {
    if (!isLoggedIn || !hydrated || !serverReady.current) return;
    const timer = setTimeout(() => {
      // Best effort: the local cart is the one that matters for checkout.
      saveCart(items, i18n.language).catch(() => null);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [items, isLoggedIn, hydrated, i18n.language]);

  return null;
};

export default CartSync;
