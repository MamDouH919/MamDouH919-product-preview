import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import { AdminReview, MyReview, ReviewPayload, ReviewStatus } from "./types";

// ── Customer ──

export const createReview = async (data: ReviewPayload & { productId: string }): Promise<MyReview> => {
  const response = await customerApi.post("/reviews/me", data);
  return response.data;
};

export const updateMyReview = async ({ id, data }: { id: string; data: ReviewPayload }): Promise<MyReview> => {
  const response = await customerApi.patch(`/reviews/me/${id}`, data);
  return response.data;
};

export const deleteMyReview = async (id: string): Promise<MyReview> => {
  const response = await customerApi.delete(`/reviews/me/${id}`);
  return response.data;
};

// ── Admin ──

export const setReviewStatus = async ({ id, status }: { id: string; status: ReviewStatus }): Promise<AdminReview> => {
  const response = await api.patch(`/reviews/${id}/status`, { status });
  return response.data;
};

export const replyToReview = async ({ id, reply }: { id: string; reply: string }): Promise<AdminReview> => {
  const response = await api.patch(`/reviews/${id}/reply`, { reply });
  return response.data;
};

export const deleteReview = async (id: string): Promise<AdminReview> => {
  const response = await api.delete(`/reviews/${id}`);
  return response.data;
};
