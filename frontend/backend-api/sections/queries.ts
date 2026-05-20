import api from "@/lib/api";
import { Section } from "./types";

export const fetchSections = async (): Promise<Section[]> => {
    const response = await api.get('/sections');
    return response.data;
};

export const fetchSectionById = async (id: string): Promise<Section> => {
    const response = await api.get(`/sections/${id}`);
    return response.data;
};

export const fetchSectionByName = async (sectionName: string): Promise<Section> => {
    const response = await api.get(`/sections/name/${sectionName}`);
    return response.data;
};
