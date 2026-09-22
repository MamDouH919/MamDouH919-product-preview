import api from "@/lib/api";
import { Contact } from "./types";

export const fetchContacts = async (): Promise<Contact[]> => {
  const response = await api.get("/contact");
  return response.data;
};

export const fetchContactById = async (id: string): Promise<Contact> => {
  const response = await api.get(`/contact/${id}`);
  return response.data;
};
