import api from "@/lib/api";
import { SubCategory } from "./types";

export const fetchSubCategories = async (categoryId?: string): Promise<SubCategory[]> => {
  const response = await api.get("/sub-categories", {
    params: categoryId ? { categoryId } : undefined,
  });
  return response.data;
};

export const fetchSubCategoryById = async (id: string): Promise<SubCategory> => {
  const response = await api.get(`/sub-categories/${id}`);
  return response.data;
};
