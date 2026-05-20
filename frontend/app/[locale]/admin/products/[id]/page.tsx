"use client";

import { use, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, CircularProgress, Stack } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useProductByIdQuery } from "@/backend-api/products/hooks";
import ProductForm from "@/features/Product/ProductForm";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

const EditProductPage = ({ params }: EditProductPageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: product, isLoading } = useProductByIdQuery(id);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("products"), link: `/admin/products` },
          { title: t("editProduct") },
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
      <ProductForm defaultData={product} />
    </Box>
  );
};

export default EditProductPage;
