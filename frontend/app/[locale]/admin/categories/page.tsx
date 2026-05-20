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
import { useCategoriesQuery, CATEGORIES_QUERY_KEY } from "@/backend-api/categories/hooks";
import { deleteCategory, updateCategory } from "@/backend-api/categories/mutations";
import { Category } from "@/backend-api/categories/types";
import { getBackendUri } from "@/utils/helperFunctions";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";

const CategoriesPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: categories, isLoading } = useCategoriesQuery();

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      const formData = new FormData();
      formData.append("isActive", String(isActive));
      return updateCategory({ id, data: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("categories") }],
        breadCrumbBtns: [
          {
            title: t("createCategory"),
            icon: "add",
            link: `/${i18n.language}/admin/categories/create`,
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
        render: (row: Category) => {
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
        render: (row: Category) => row.name[lang] ?? row.name.en ?? row.name.ar ?? "",
      },
      {
        id: "slug",
        header: t("slug"),
        render: (row: Category) => row.slug,
      },
      {
        id: "order",
        header: t("order"),
        render: (row: Category) => row.order,
      },
      {
        id: "isActive",
        header: t("active"),
        render: (row: Category) => (
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
        render: (row: Category) => (
          <Stack direction="row">
            <CustomLink href={`/admin/categories/${row._id}`}>
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
      data={categories ?? []}
      borderRadius={0}
      height="100%"
      loading={isLoading}
    />
  );
};

export default CategoriesPage;
