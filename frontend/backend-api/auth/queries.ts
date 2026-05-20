import api from "@/lib/api";
import { AuthUser } from "./types";

export const fetchMe = async (token: string): Promise<AuthUser> => {
    const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};
