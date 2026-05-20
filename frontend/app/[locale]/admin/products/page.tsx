"use client";

import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Chip, IconButton, Stack, Switch } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Image from "next/image";
import { useProductsQuery, PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { deleteProduct, updateProduct } from "@/backend-api/products/mutations";
import { Product } from "@/backend-api/products/types";
import { getBackendUri } from "@/utils/helperFunctions";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";

const ProductsPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: products, isLoading } = useProductsQuery();

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      const formData = new FormData();
      formData.append("isActive", String(isActive));
      return updateProduct({ id, data: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("products") }],
        breadCrumbBtns: [
          {
            title: t("createProduct"),
            icon: "add",
            link: `/${i18n.language}/admin/products/create`,
          },
        ],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "image",
        header: t("image"),
        render: (row: Product) => {
          const imageUrl = getBackendUri(row.images?.[0]);
          if (!imageUrl) return null;
          return (
            <Stack p={0.5}>
              <Image
                src={imageUrl}
                alt={row.name[lang] ?? ""}
                width={60}
                height={60}
                style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4 }}
                loading="eager"
              />
            </Stack>
          );
        },
      },
      {
        id: "name",
        header: t("name"),
        render: (row: Product) => row.name[lang] ?? row.name.en ?? row.name.ar ?? "",
      },
      {
        id: "category",
        header: t("category"),
        render: (row: Product) =>
          row.category?.name?.[lang] ?? row.category?.name?.en ?? "",
      },
      {
        id: "subCategory",
        header: t("subCategory"),
        render: (row: Product) =>
          row.subCategory?.name?.[lang] ?? row.subCategory?.name?.en ?? "—",
      },
      {
        id: "price",
        header: t("price"),
        render: (row: Product) =>
          row.price !== undefined ? row.price : "—",
      },
      {
        id: "images",
        header: t("images"),
        render: (row: Product) => (
          <Chip label={row.images?.length ?? 0} size="small" variant="outlined" />
        ),
      },
      {
        id: "isActive",
        header: t("active"),
        render: (row: Product) => (
          <Switch
            checked={!!row.isActive}
            onChange={(e) =>
              toggleActiveMutation.mutate({ id: row._id, isActive: e.target.checked })
            }
            disabled={toggleActiveMutation.isPending}
            size="small"
          />
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        render: (row: Product) => (
          <Stack direction="row">
            <CustomLink href={`/admin/products/${row._id}`}>
              <IconButton>
                <Edit />
              </IconButton>
            </CustomLink>
            <IconButton
              color="error"
              onClick={() => deleteMutation.mutate(row._id)}
              disabled={deleteMutation.isPending}
            >
              <Delete />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [t, lang, toggleActiveMutation, deleteMutation]
  );

  return (
    <SimpleTable
      columns={columns}
      data={products ?? []}
      borderRadius={0}
      height="100%"
      loading={isLoading}
    />
  );
};

export default ProductsPage;
