import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchCategoryById, fetchCategoryBySlug } from "./queries";

export const CATEGORIES_QUERY_KEY = "categories";

export const useCategoriesQuery = () => {
  return useQuery({
    queryKey: [CATEGORIES_QUERY_KEY],
    queryFn: fetchCategories,
  });
};

export const useCategoryByIdQuery = (id: string) => {
  return useQuery({
    queryKey: [CATEGORIES_QUERY_KEY, id],
    queryFn: () => fetchCategoryById(id),
    enabled: !!id,
  });
};

export const useCategoryBySlugQuery = (slug: string) => {
  return useQuery({
    queryKey: [CATEGORIES_QUERY_KEY, "slug", slug],
    queryFn: () => fetchCategoryBySlug(slug),
    enabled: !!slug,
  });
};
