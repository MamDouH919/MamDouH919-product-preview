import api from "@/lib/api";
import { Setting } from "./types";

export const updateSettings = async (data: FormData): Promise<Setting> => {
    const response = await api.patch('/settings', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
