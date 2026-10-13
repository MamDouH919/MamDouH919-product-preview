import { useQuery } from "@tanstack/react-query";
import { fetchCoupons } from "./queries";

export const COUPONS_QUERY_KEY = "coupons";

export const useCouponsQuery = (search?: string) => {
  return useQuery({
    queryKey: [COUPONS_QUERY_KEY, search],
    queryFn: () => fetchCoupons(search),
  });
};
