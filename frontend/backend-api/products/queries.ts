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

/** Best matches for a product: same sub-category, category, tags and bought-together. */
export const fetchRelatedProducts = async (id: string, limit = 8): Promise<Product[]> => {
  const response = await api.get(`/products/${id}/related`, { params: { limit } });
  return response.data;
};

/** Active products in the order the ids were given; unknown or hidden ones are skipped. */
export const fetchProductsByIds = async (ids: string[]): Promise<Product[]> => {
  const response = await api.get("/products/by-ids", { params: { ids: ids.join(",") } });
  return response.data;
};

export const exportProductsCsv = async (): Promise<Blob> => {
  const response = await api.get("/products/export", { responseType: "blob" });
  return response.data;
};

export type ProductImportRow = {
  line: number;
  product: string;
  action: "create" | "update" | "unchanged" | "error";
  changes: string[];
  errors: string[];
};

export type ProductImportReport = {
  applied: boolean;
  summary: { create: number; update: number; unchanged: number; error: number };
  rows: ProductImportRow[];
};

/** Without `apply` the server only reports what would change. */
export const importProductsCsv = async ({ file, apply }: { file: File; apply: boolean }): Promise<ProductImportReport> => {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post("/products/import", form, { params: { apply: apply ? "true" : undefined } });
  return response.data;
};
