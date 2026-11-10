"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FALLBACK_LOCALES, SUPPORTED_LOCALES, type Locale, type StoreLocales } from "./locales";

const StoreLocalesContext = createContext<StoreLocales>(FALLBACK_LOCALES);

/** The store's languages, resolved by the server layout so the first render already has them. */
export function StoreLocalesProvider({ value, children }: { value: StoreLocales; children: ReactNode }) {
  return <StoreLocalesContext.Provider value={value}>{children}</StoreLocalesContext.Provider>;
}

/**
 * The languages the store's site is published in, default first. Content
 * forms ask for texts in these only; the storefront offers only these.
 */
export function useStoreLocales(): StoreLocales & { multilingual: boolean } {
  const value = useContext(StoreLocalesContext);
  return { ...value, multilingual: value.languages.length > 1 };
}

/** Every language the dashboard's own interface can be shown in, whatever the site is published in. */
export const INTERFACE_LOCALES: readonly Locale[] = SUPPORTED_LOCALES;
