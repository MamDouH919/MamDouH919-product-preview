import { getRefreshTokenFromCookie, handleLogout, setAdminSession } from "@/actions/cookies";
import { getBackendUrl } from "@/lib/getBackendUrl";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";

const api = axios.create({
    baseURL: getBackendUrl(),
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    },
});

// Resolve the tenant backend per request so the correct `api.<host>` is used
// once the browser host is known (the create-time value may be empty on SSR).
api.interceptors.request.use((config) => {
    config.baseURL = getBackendUrl();
    return config;
});

export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers["Authorization"] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers["Authorization"];
    }
};

// ── Session refresh ───────────────────────────────────────────────────────────
// The access token lives 12h; the refresh token 7 days. When a request comes
// back 401 we trade the refresh token for a new pair and replay the request,
// and only log out if the backend refuses the refresh token itself.
//
// The call goes from the browser (not a server action) because the backend
// picks the tenant from the hostname it is reached on, and only the browser
// reliably knows the right `api.<host>`.

let refreshing: Promise<string | null> | null = null;

/**
 * A new access token, or null when the session is over (no refresh token, or
 * the backend rejected it). Throws on network/server errors, which are not a
 * reason to log anyone out. Concurrent callers share one request, since a
 * refresh token is rotated on use.
 */
export function refreshAdminSession(): Promise<string | null> {
    refreshing ??= (async () => {
        try {
            const refreshToken = await getRefreshTokenFromCookie();
            if (!refreshToken) return null;

            // Plain axios, not `api`: a 401 here must not re-enter the interceptor.
            const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
                `${getBackendUrl()}/auth/refresh`,
                { token: refreshToken },
            );
            await setAdminSession(data.accessToken, data.refreshToken);
            setAuthToken(data.accessToken);
            return data.accessToken;
        } catch (error) {
            const status = (error as AxiosError).response?.status;
            if (status === 401 || status === 400) {
                // Dead session: drop its cookies so later page loads don't retry it.
                await handleLogout();
                return null;
            }
            throw error;
        } finally {
            refreshing = null;
        }
    })();
    return refreshing;
}

async function endSession() {
    toast.error("Session expired. You've been logged out.");

    setAuthToken(null);
    await handleLogout();

    // Reset Redux state and redirect — lazy import to avoid circular deps
    const { store } = await import("@/Store/store");
    const { resetAuthData } = await import("@/Store/slices/auth");
    store.dispatch(resetAuthData());

    if (typeof window !== "undefined") {
        const locale = window.location.pathname.split("/")[1] ?? "en";
        window.location.href = `/${locale}/login`;
    }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined;
        // A 401 from login is a credentials problem, not an expired session.
        const isLogin = original?.url?.includes("/auth/login");

        if (error.response?.status !== 401 || !original || isLogin) {
            return Promise.reject(error);
        }

        if (!original._retried) {
            original._retried = true;
            let token: string | null;
            try {
                token = await refreshAdminSession();
            } catch {
                // Backend unreachable — keep the session, surface the original error.
                return Promise.reject(error);
            }
            if (token) {
                original.headers.set("Authorization", `Bearer ${token}`);
                return api(original);
            }
        }

        await endSession();
        return Promise.reject(error);
    }
);

export default api;
