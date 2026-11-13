import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "./queries";

export const USERS_QUERY_KEY = "staff-users";

export const useUsersQuery = (search?: string) =>
  useQuery({ queryKey: [USERS_QUERY_KEY, search], queryFn: () => fetchUsers(search) });
