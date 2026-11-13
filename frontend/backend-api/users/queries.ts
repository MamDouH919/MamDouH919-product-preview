import api from "@/lib/api";
import { StaffUser } from "./types";

export const fetchUsers = async (search?: string): Promise<StaffUser[]> => {
  const response = await api.get("/users", { params: { search: search || undefined } });
  return response.data;
};
