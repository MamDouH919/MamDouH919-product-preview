import api from "@/lib/api";
import { CreateUserPayload, StaffUser, UpdateUserPayload } from "./types";

export const createUser = async (data: CreateUserPayload): Promise<StaffUser> => {
  const response = await api.post("/users", data);
  return response.data;
};

export const updateUser = async ({ id, data }: { id: string; data: UpdateUserPayload }): Promise<StaffUser> => {
  const response = await api.put(`/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id: string) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};
