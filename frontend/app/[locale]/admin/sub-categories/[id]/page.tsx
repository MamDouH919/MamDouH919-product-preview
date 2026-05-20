"use client";

import { use, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, CircularProgress, Stack } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useSubCategoryByIdQuery } from "@/backend-api/sub-categories/hooks";
import SubCategoryForm from "@/features/SubCategory/SubCategoryForm";

interface EditSubCategoryPageProps {
  params: Promise<{ id: string }>;
}

const EditSubCategoryPage = ({ params }: EditSubCategoryPageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: subCategory, isLoading } = useSubCategoryByIdQuery(id);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("subCategories"), link: `/admin/sub-categories` },
          { title: t("editSubCategory") },
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
      <SubCategoryForm defaultData={subCategory} />
    </Box>
  );
};

export default EditSubCategoryPage;
