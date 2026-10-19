import api from "@/lib/api";
import { Page, PageNavItem } from "./types";

export const fetchPages = async (): Promise<Page[]> => {
    const response = await api.get('/pages');
    return response.data;
};

export const fetchPageById = async (id: string): Promise<Page> => {
    const response = await api.get(`/pages/${id}`);
    return response.data;
};

export const fetchPageBySlug = async (slug: string): Promise<Page> => {
    const response = await api.get(`/pages/slug/${encodeURIComponent(slug)}`);
    return response.data;
};

export const fetchPagesNavigation = async (): Promise<PageNavItem[]> => {
    const response = await api.get('/pages/navigation');
    return response.data;
};
