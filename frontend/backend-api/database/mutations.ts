import api from "@/lib/api";

export const exportDatabase = async (): Promise<Blob> => {
    const response = await api.get('/database/export', { responseType: 'blob' });
    return response.data;
};

export const importDatabase = async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    await api.post('/database/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};
