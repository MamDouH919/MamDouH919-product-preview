"use client";

import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconButton, Stack, Switch } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Image from "next/image";
import { useSubCategoriesQuery, SUB_CATEGORIES_QUERY_KEY } from "@/backend-api/sub-categories/hooks";
import { deleteSubCategory, updateSubCategory } from "@/backend-api/sub-categories/mutations";
import { SubCategory } from "@/backend-api/sub-categories/types";
import { getBackendUri } from "@/utils/helperFunctions";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";

const SubCategoriesPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: subCategories, isLoading } = useSubCategoriesQuery();

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      const formData = new FormData();
      formData.append("isActive", String(isActive));
      return updateSubCategory({ id, data: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUB_CATEGORIES_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubCategory,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SUB_CATEGORIES_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("subCategories") }],
        breadCrumbBtns: [
          {
            title: t("createSubCategory"),
            icon: "add",
            link: `/${i18n.language}/admin/sub-categories/create`,
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
        render: (row: SubCategory) => {
          const imageUrl = getBackendUri(row.image);
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
        render: (row: SubCategory) => row.name[lang] ?? row.name.en ?? row.name.ar ?? "",
      },
      {
        id: "category",
        header: t("category"),
        render: (row: SubCategory) =>
          row.category?.name?.[lang] ?? row.category?.name?.en ?? row.category?.name?.ar ?? "",
      },
      {
        id: "slug",
        header: t("slug"),
        render: (row: SubCategory) => row.slug,
      },
      {
        id: "order",
        header: t("order"),
        render: (row: SubCategory) => row.order,
      },
      {
        id: "isActive",
        header: t("active"),
        render: (row: SubCategory) => (
          <Switch
            checked={!!row.isActive}
            onChange={(e) => toggleActiveMutation.mutate({ id: row._id, isActive: e.target.checked })}
            disabled={toggleActiveMutation.isPending}
            size="small"
          />
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        render: (row: SubCategory) => (
          <Stack direction="row">
            <CustomLink href={`/admin/sub-categories/${row._id}`}>
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
      data={subCategories ?? []}
      borderRadius={0}
      height="100%"
      loading={isLoading}
    />
  );
};

export default SubCategoriesPage;
