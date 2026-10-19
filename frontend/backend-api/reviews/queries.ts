import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { AdminReviewsResponse, ProductReviewsResponse, ReviewEligibility, ReviewFilters } from "./types";

export const fetchProductReviews = async (
  productId: string,
  page = 1,
  limit = 5
): Promise<ProductReviewsResponse> => {
  const response = await customerApi.get(`/reviews/product/${productId}`, { params: { page, limit } });
  return response.data;
};

export const fetchReviewEligibility = async (productId: string): Promise<ReviewEligibility> => {
  const response = await customerApi.get(`/reviews/me/eligibility/${productId}`);
  return response.data;
};

export const fetchReviews = async (filters?: ReviewFilters): Promise<AdminReviewsResponse> => {
  const response = await api.get("/reviews", { params: filters });
  return response.data;
};
