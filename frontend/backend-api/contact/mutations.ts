import api from "@/lib/api";
import { Contact, CreateContactPayload } from "./types";

export const sendContactMessage = async (data: CreateContactPayload): Promise<Contact> => {
    const response = await api.post('/contact', data);
    return response.data;
};

export const markContactAsRead = async (id: string): Promise<Contact> => {
    const response = await api.patch(`/contact/${id}/read`);
    return response.data;
};

export const deleteContact = async (id: string): Promise<void> => {
    await api.delete(`/contact/${id}`);
};
