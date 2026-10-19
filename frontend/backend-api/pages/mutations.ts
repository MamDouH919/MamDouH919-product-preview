import api from "@/lib/api";
import { Page, PagePayload } from "./types";

export const createPage = async (data: PagePayload): Promise<Page> => {
    const response = await api.post('/pages', data);
    return response.data;
};

export const updatePage = async ({ id, data }: { id: string; data: Partial<PagePayload> }): Promise<Page> => {
    const response = await api.patch(`/pages/${id}`, data);
    return response.data;
};

export const duplicatePage = async (id: string): Promise<Page> => {
    const response = await api.post(`/pages/${id}/duplicate`);
    return response.data;
};

export const deletePage = async (id: string): Promise<Page> => {
    const response = await api.delete(`/pages/${id}`);
    return response.data;
};

/** Uploads one image for a page block and returns its stored path. */
export const uploadPageImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await api.post('/pages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.path;
};
