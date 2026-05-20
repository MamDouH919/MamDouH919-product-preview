import { useQuery } from "@tanstack/react-query";
import { fetchSubCategories, fetchSubCategoryById } from "./queries";

export const SUB_CATEGORIES_QUERY_KEY = "sub-categories";

export const useSubCategoriesQuery = (categoryId?: string) => {
  return useQuery({
    queryKey: [SUB_CATEGORIES_QUERY_KEY, categoryId],
    queryFn: () => fetchSubCategories(categoryId),
  });
};

export const useSubCategoryByIdQuery = (id: string) => {
  return useQuery({
    queryKey: [SUB_CATEGORIES_QUERY_KEY, id],
    queryFn: () => fetchSubCategoryById(id),
    enabled: !!id,
  });
};
