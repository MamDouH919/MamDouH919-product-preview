import api from "@/lib/api";

export const createSection = async (data: FormData): Promise<any> => {
    const response = await api.post('/sections', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const updateSection = async ({ id, data }: { id: string; data: FormData }): Promise<any> => {
    const response = await api.patch(`/sections/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
