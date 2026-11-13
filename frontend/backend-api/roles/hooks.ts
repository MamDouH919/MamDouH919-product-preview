import { useQuery } from "@tanstack/react-query";
import { fetchRoles } from "./queries";

export const ROLES_QUERY_KEY = "roles";

export const useRolesQuery = (enabled = true) =>
  useQuery({ queryKey: [ROLES_QUERY_KEY], queryFn: fetchRoles, enabled });
