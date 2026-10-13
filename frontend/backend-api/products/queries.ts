import api from "@/lib/api";
import { Product, ProductSearchParams, ProductSearchResponse } from "./types";

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

/** Storefront catalogue: active products only, filtered and paged on the server. */
export const searchProducts = async (
  params: ProductSearchParams
): Promise<ProductSearchResponse> => {
  const response = await api.get("/products/search", { params });
  return response.data;
};
