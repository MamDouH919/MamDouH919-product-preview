import api from "@/lib/api";
import { Setting } from "./types";

export const fetchSettings = async (): Promise<Setting> => {
    const response = await api.get('/settings');
    return response.data;
};
