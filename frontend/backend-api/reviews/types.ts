import { LocalizedField } from "../globalTypes";

export type ReviewStatus = "pending" | "approved" | "rejected";

export const REVIEW_STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

/** A review as the storefront sees it — approved, author shortened to "Sara A.". */
export type PublicReview = {
  _id: string;
  authorName: string;
  rating: number;
  comment?: string;
  reply?: string;
  repliedAt?: string;
  createdAt: string;
};

export type RatingSummary = {
  average: number;
  count: number;
  /** Approved reviews per star, keyed "1" … "5". */
  distribution: Record<string, number>;
};

export type ProductReviewsResponse = {
  data: PublicReview[];
  total: number;
  page: number;
  limit: number;
  summary: RatingSummary;
};

export type MyReview = PublicReview & { status: ReviewStatus; product: string };

export type ReviewEligibility = {
  canReview: boolean;
  /** True once an order with this product has been delivered to the customer. */
  hasPurchased: boolean;
  review: MyReview | null;
};

export type ReviewPayload = { rating: number; comment?: string };

export type AdminReview = {
  _id: string;
  product: { _id: string; name: LocalizedField; slug: string; images: string[] } | null;
  customer: { _id: string; name: string; email: string } | null;
  authorName: string;
  rating: number;
  comment?: string;
  status: ReviewStatus;
  reply?: string;
  repliedAt?: string;
  createdAt: string;
};

export type ReviewFilters = {
  status?: ReviewStatus;
  rating?: number;
  search?: string;
  page?: number;
  limit?: number;
};

export type AdminReviewsResponse = {
  data: AdminReview[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<ReviewStatus, number>;
};
