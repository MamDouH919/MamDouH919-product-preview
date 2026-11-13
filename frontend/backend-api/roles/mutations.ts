import api from "@/lib/api";
import { Role, RolePayload } from "./types";

export const createRole = async (data: RolePayload): Promise<Role> => {
  const response = await api.post("/roles", data);
  return response.data;
};

export const updateRole = async ({ id, data }: { id: string; data: RolePayload }): Promise<Role> => {
  const response = await api.put(`/roles/${id}`, data);
  return response.data;
};

export const deleteRole = async (id: string) => {
  const response = await api.delete(`/roles/${id}`);
  return response.data;
};
