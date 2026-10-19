import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/Store/store";
import { fetchProductReviews, fetchReviewEligibility, fetchReviews } from "./queries";
import { ReviewFilters } from "./types";

export const PRODUCT_REVIEWS_QUERY_KEY = "product-reviews";
export const REVIEW_ELIGIBILITY_QUERY_KEY = "review-eligibility";
export const REVIEWS_QUERY_KEY = "reviews";

export const useProductReviewsQuery = (productId: string | undefined, page: number, limit = 5) => {
  return useQuery({
    queryKey: [PRODUCT_REVIEWS_QUERY_KEY, productId, page, limit],
    queryFn: () => fetchProductReviews(productId!, page, limit),
    enabled: !!productId,
    placeholderData: keepPreviousData,
  });
};

export const useReviewEligibilityQuery = (productId: string | undefined) => {
  const isLoggedIn = useAppSelector((state) => state.customer.isLoggedIn);

  return useQuery({
    queryKey: [REVIEW_ELIGIBILITY_QUERY_KEY, productId],
    queryFn: () => fetchReviewEligibility(productId!),
    enabled: isLoggedIn && !!productId,
  });
};

export const useReviewsQuery = (filters?: ReviewFilters) => {
  return useQuery({
    queryKey: [REVIEWS_QUERY_KEY, filters],
    queryFn: () => fetchReviews(filters),
    placeholderData: keepPreviousData,
  });
};
