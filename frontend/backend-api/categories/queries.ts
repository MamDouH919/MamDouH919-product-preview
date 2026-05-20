import api from "@/lib/api";
import { Category } from "./types";

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await api.get("/categories");
  return response.data;
};

export const fetchCategoryById = async (id: string): Promise<Category> => {
  const response = await api.get(`/categories/${id}`);
  return response.data;
};

export const fetchCategoryBySlug = async (slug: string): Promise<Category> => {
  const response = await api.get(`/categories/slug/${slug}`);
  return response.data;
};
