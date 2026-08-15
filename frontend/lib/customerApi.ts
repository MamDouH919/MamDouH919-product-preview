import { handleCustomerLogout } from "@/actions/cookies";
import { getBackendUrl } from "@/lib/getBackendUrl";
import axios from "axios";
import { toast } from "sonner";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Handle a 401 at the call site instead of logging the customer out. */
    skipAuthRedirect?: boolean;
  }
}

/**
 * A second axios instance for storefront customers.
 *
 * It cannot share the admin `api` instance: that one keeps a single
 * `Authorization` default header — so whichever session logged in last would
 * win — and sends every 401 to the dashboard login page. Customers need their
 * own token and their own place to land when a session expires.
 */
const customerApi = axios.create({
  baseURL: getBackendUrl(),
  headers: {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
});

// Resolve the tenant backend per request — on SSR the create-time value is
// empty because there is no window to read the host from.
customerApi.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  return config;
});

export const setCustomerAuthToken = (token: string | null) => {
  if (token) {
    customerApi.defaults.headers["Authorization"] = `Bearer ${token}`;
  } else {
    delete customerApi.defaults.headers["Authorization"];
  }
};

customerApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? "";

    // A failed login or register is the user getting their password wrong —
    // not an expired session. Logging them out over it would be nonsense.
    const isAuthAttempt =
      url.includes("/customer-auth/login") ||
      url.includes("/customer-auth/register");

    // Session restore runs on every public page. A stale cookie there should
    // quietly clear itself, not throw a browsing visitor onto the login page.
    const skipRedirect = error.config?.skipAuthRedirect === true;

    if (status === 401 && !isAuthAttempt && !skipRedirect) {
      toast.error("Session expired. Please sign in again.");

      setCustomerAuthToken(null);
      await handleCustomerLogout();

      const { store } = await import("@/Store/store");
      const { resetCustomer } = await import("@/Store/slices/customer");
      store.dispatch(resetCustomer());

      if (typeof window !== "undefined") {
        const locale = window.location.pathname.split("/")[1] ?? "en";
        window.location.href = `/${locale}/account/login`;
      }
    }

    return Promise.reject(error);
  }
);

export default customerApi;
