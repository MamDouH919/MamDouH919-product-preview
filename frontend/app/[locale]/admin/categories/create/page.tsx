"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import CategoryForm from "@/features/Category/CategoryForm";

const CreateCategoryPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("categories"), link: `/admin/categories` },
          { title: t("createCategory") },
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
      <CategoryForm />
    </Box>
  );
};

export default CreateCategoryPage;
