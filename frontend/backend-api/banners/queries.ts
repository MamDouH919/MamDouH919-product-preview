import api from "@/lib/api";
import { Banner } from "./types";

export const fetchBanners = async (): Promise<Banner[]> => {
    const response = await api.get('/banners');
    return response.data;
};

export const fetchBannerById = async (id: string): Promise<Banner> => {
    const response = await api.get(`/banners/${id}`);
    return response.data;
};
