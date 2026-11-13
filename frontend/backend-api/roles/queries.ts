import api from "@/lib/api";
import { Role } from "./types";

export const fetchRoles = async (): Promise<Role[]> => {
  const response = await api.get("/roles");
  return response.data;
};
