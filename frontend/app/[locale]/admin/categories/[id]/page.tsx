"use client";

import { use, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, CircularProgress, Stack } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useCategoryByIdQuery } from "@/backend-api/categories/hooks";
import CategoryForm from "@/features/Category/CategoryForm";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

const EditCategoryPage = ({ params }: EditCategoryPageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: category, isLoading } = useCategoryByIdQuery(id);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("categories"), link: `/admin/categories` },
          { title: t("editCategory") },
        ],
        breadCrumbBtns: [],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Box py={3}>
      <CategoryForm defaultData={category} />
    </Box>
  );
};

export default EditCategoryPage;
