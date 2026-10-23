"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/Store/store";
import { resetCustomer, setCustomer } from "@/Store/slices/customer";
import { fetchCustomerProfileSilent } from "@/backend-api/customers/queries";
import { setCustomerAuthToken } from "@/lib/customerApi";
import {
  getCustomerTokenFromCookie,
  handleCustomerLogout,
} from "@/actions/cookies";
import { useStoreModules } from "@/Hooks/useStoreModules";

/**
 * Restores the storefront session on load — the customer equivalent of
 * `GetUserLogged`. Wraps the public site so a returning visitor stays signed in
 * without an admin session being involved either way.
 */
const GetCustomerLogged = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();
  const initialized = useRef(false);
  // A store without online orders has no customer accounts to restore.
  const { has } = useStoreModules();
  const accounts = has("orders");

  useEffect(() => {
    if (!accounts || initialized.current) return;
    initialized.current = true;

    (async () => {
      const token = await getCustomerTokenFromCookie();

      if (!token) {
        dispatch(resetCustomer());
        return;
      }

      try {
        setCustomerAuthToken(token);
        dispatch(setCustomer(await fetchCustomerProfileSilent()));
      } catch {
        // Expired or revoked — drop it rather than leaving a token that will
        // fail on every later request.
        setCustomerAuthToken(null);
        await handleCustomerLogout();
        dispatch(resetCustomer());
      }
    })();
  }, [dispatch, accounts]);

  return <>{children}</>;
};

export default GetCustomerLogged;
