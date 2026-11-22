"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconButton, Stack, Switch, Tooltip, Typography } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import {
  useSubCategoriesQuery,
  SUB_CATEGORIES_QUERY_KEY,
} from "@/backend-api/sub-categories/hooks";
import {
  deleteSubCategory,
  updateSubCategory,
} from "@/backend-api/sub-categories/mutations";
import { SubCategory } from "@/backend-api/sub-categories/types";
import { getBackendUri } from "@/utils/helperFunctions";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import Thumb from "@/components/Table/Thumb";
import SimpleTable from "@/components/Table/SimpleTable";
import Can from "@/components/Can";
import { usePermissions } from "@/Hooks/usePermissions";
import CustomLink from "@/components/CustomLink";

const SubCategoriesPage = () => {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: items, isLoading } = useSubCategoriesQuery();

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
        breadCrumbBtns: can("sub-categories", "create")
          ? [
              {
                title: t("createSubCategory"),
                icon: "add",
                link: `/${i18n.language}/admin/sub-categories/create`,
              },
            ]
          : [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: t("name"),
        render: (row: SubCategory) => (
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Thumb src={getBackendUri(row.image)} alt={row.name[lang] ?? ""} />
            <Stack minWidth={0}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {row.name[lang] ?? row.name.en ?? row.name.ar ?? ""}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                dir="ltr"
                sx={{ textAlign: "start" }}
              >
                /{row.slug}
              </Typography>
            </Stack>
          </Stack>
        ),
      },
      {
        id: "category",
        header: t("category"),
        render: (row: SubCategory) =>
          row.category?.name?.[lang] ??
          row.category?.name?.en ??
          row.category?.name?.ar ??
          "",
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
            onChange={(e) =>
              toggleActiveMutation.mutate({
                id: row._id,
                isActive: e.target.checked,
              })
            }
            disabled={toggleActiveMutation.isPending}
            size="small"
          />
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: SubCategory) => (
          <Stack direction="row" gap={0.25}>
            <Can resource="sub-categories" action="update">
              <Tooltip title={t("edit")}>
                <IconButton
                  size="small"
                  component={CustomLink}
                  href={`/admin/sub-categories/${row._id}`}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
            <Can resource="sub-categories" action="delete">
              <Tooltip title={t("delete")}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleting(row)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
          </Stack>
        ),
      },
    ],
    [t, lang, toggleActiveMutation],
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">();
  const [categoryId, setCategoryId] = useState<string>();
  const [deleting, setDeleting] = useState<SubCategory | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items ?? []).filter(
      (r) =>
        (!status || (status === "active") === !!r.isActive) &&
        (!categoryId || r.category?._id === categoryId) &&
        (!term ||
          [r.name.en, r.name.ar, r.slug].some((v) =>
            v?.toLowerCase().includes(term),
          )),
    );
  }, [items, search, status, categoryId]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (items ?? []).forEach((r) => {
      if (r.category?._id)
        seen.set(
          r.category._id,
          r.category.name?.[lang] ??
            r.category.name?.en ??
            r.category.name?.ar ??
            "",
        );
    });
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [items, lang]);

  const chips = [
    ...(categoryId
      ? [
          {
            key: "cat",
            label:
              categoryOptions.find((o) => o.value === categoryId)?.label ??
              t("category"),
            onDelete: () => setCategoryId(undefined),
          },
        ]
      : []),
    ...(status
      ? [
          {
            key: "status",
            label: t(status),
            onDelete: () => setStatus(undefined),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: "search",
            label: `${t("search")}: ${search}`,
            onDelete: () => setSearch(""),
          },
        ]
      : []),
  ];

  return (
    <>
      <FilterLayout
        search={{ value: search, onChange: setSearch }}
        activeCount={chips.length}
        chips={chips}
        onClear={() => {
          setSearch("");
          setStatus(undefined);
          setCategoryId(undefined);
        }}
        filters={
          <>
            <FilterSelect
              label={t("category")}
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
            />
            <FilterSelect
              label={t("status")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "active", label: t("active") },
                { value: "inactive", label: t("inactive") },
              ]}
            />
          </>
        }
      >
        <SimpleTable
          clientPagination
          columns={columns}
          data={rows}
          height="100%"
          loading={isLoading}
        />
      </FilterLayout>
      <ConfirmDialog
        title={deleting ? t("delete") : null}
        message={deleting?.name[lang] ?? deleting?.name.en ?? deleting?.name.ar}
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteMutation.mutate(deleting._id, {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </>
  );
};

export default SubCategoriesPage;
