"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import SubCategoryForm from "@/features/SubCategory/SubCategoryForm";

const CreateSubCategoryPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("subCategories"), link: `/admin/sub-categories` },
          { title: t("createSubCategory") },
        ],
        breadCrumbBtns: [],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box py={3}>
      <SubCategoryForm />
    </Box>
  );
};

export default CreateSubCategoryPage;
