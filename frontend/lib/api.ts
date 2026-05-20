import { handleLogout } from "@/actions/cookies";
import axios from "axios";
import { toast } from "sonner";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    },
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
