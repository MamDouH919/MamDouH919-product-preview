import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchProducts,
  fetchProductById,
  fetchProductBySlug,
  fetchProductsByIds,
  fetchRelatedProducts,
  searchProducts,
} from "./queries";
import { ProductSearchParams } from "./types";

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

/** Pages of search results; `fetchNextPage` appends the next one ("load more"). */
export const useProductSearchQuery = (params: Omit<ProductSearchParams, "page">) => {
  return useInfiniteQuery({
    queryKey: [PRODUCTS_QUERY_KEY, "search", params],
    queryFn: ({ pageParam }) => searchProducts({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });
};

export const useRelatedProductsQuery = (id: string | undefined, limit = 8) => {
  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, "related", id, limit],
    queryFn: () => fetchRelatedProducts(id!, limit),
    enabled: !!id,
  });
};

export const useProductsByIdsQuery = (ids: string[]) => {
  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, "by-ids", ids],
    queryFn: () => fetchProductsByIds(ids),
    enabled: ids.length > 0,
  });
};
