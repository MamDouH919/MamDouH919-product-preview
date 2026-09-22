import { useQuery } from "@tanstack/react-query";
import { fetchContacts, fetchContactById } from "./queries";

export const CONTACT_QUERY_KEY = "contact";

export const useContactsQuery = () => {
  return useQuery({
    queryKey: [CONTACT_QUERY_KEY],
    queryFn: fetchContacts,
  });
};

export const useContactByIdQuery = (id: string) => {
  return useQuery({
    queryKey: [CONTACT_QUERY_KEY, id],
    queryFn: () => fetchContactById(id),
    enabled: !!id,
  });
};
