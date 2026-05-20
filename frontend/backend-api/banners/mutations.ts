import api from "@/lib/api";

export const createBanner = async (data: FormData): Promise<any> => {
    const response = await api.post('/banners', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const updateBanner = async ({ id, data }: { id: string; data: FormData }): Promise<any> => {
    const response = await api.patch(`/banners/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const updateBannerWeight = async ({ id, weight }: { id: string; weight: number }): Promise<any> => {
    const response = await api.patch(`/banners/${id}/weight`, { weight });
    return response.data;
};

export const toggleBannerActive = async ({ id, active }: { id: string; active: boolean }): Promise<any> => {
    const response = await api.patch(`/banners/${id}`, { active });
    return response.data;
};

export const deleteBanner = async (id: string): Promise<any> => {
    const response = await api.delete(`/banners/${id}`);
    return response.data;
};
