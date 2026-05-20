import { useQuery } from "@tanstack/react-query";
import { fetchProducts, fetchProductById, fetchProductBySlug } from "./queries";

export const PRODUCTS_QUERY_KEY = "products";

export const useProductsQuery = (params?: { categoryId?: string; subCategoryId?: string }) => {
  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, params],
    queryFn: () => fetchProducts(params),
  });
};

export const useProductByIdQuery = (id: string) => {
  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, id],
    queryFn: () => fetchProductById(id),
    enabled: !!id,
  });
};

export const useProductBySlugQuery = (slug: string) => {
  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, "slug", slug],
    queryFn: () => fetchProductBySlug(slug),
    enabled: !!slug,
  });
};
