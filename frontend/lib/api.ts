import { handleLogout } from "@/actions/cookies";
import { getBackendUrl } from "@/lib/getBackendUrl";
import axios from "axios";
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

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            toast.error("Session expired. You've been logged out.");

            // Clear axios token
            setAuthToken(null);

            // Clear cookie
            await handleLogout();

            // Reset Redux state and redirect — lazy import to avoid circular deps
            const { store } = await import("@/Store/store");
            const { resetAuthData } = await import("@/Store/slices/auth");
            store.dispatch(resetAuthData());

            // Redirect to login preserving locale
            if (typeof window !== "undefined") {
                const locale = window.location.pathname.split("/")[1] ?? "en";
                window.location.href = `/${locale}/login`;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
