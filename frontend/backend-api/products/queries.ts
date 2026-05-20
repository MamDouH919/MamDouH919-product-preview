import api from "@/lib/api";
import { Product } from "./types";

export const fetchProducts = async (params?: {
  categoryId?: string;
  subCategoryId?: string;
}): Promise<Product[]> => {
  const response = await api.get("/products", { params });
  return response.data;
};

export const fetchProductById = async (id: string): Promise<Product> => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};

export const fetchProductBySlug = async (slug: string): Promise<Product> => {
  const response = await api.get(`/products/slug/${slug}`);
  return response.data;
};
