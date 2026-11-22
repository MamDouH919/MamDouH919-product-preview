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
  useCategoriesQuery,
  CATEGORIES_QUERY_KEY,
} from "@/backend-api/categories/hooks";
import {
  deleteCategory,
  updateCategory,
} from "@/backend-api/categories/mutations";
import { Category } from "@/backend-api/categories/types";
import { getBackendUri } from "@/utils/helperFunctions";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import Thumb from "@/components/Table/Thumb";
import SimpleTable from "@/components/Table/SimpleTable";
import Can from "@/components/Can";
import { usePermissions } from "@/Hooks/usePermissions";
import CustomLink from "@/components/CustomLink";

const CategoriesPage = () => {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const { data: items, isLoading } = useCategoriesQuery();

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
        breadCrumbBtns: can("categories", "create")
          ? [
              {
                title: t("createCategory"),
                icon: "add",
                link: `/${i18n.language}/admin/categories/create`,
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
        render: (row: Category) => (
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
        render: (row: Category) => (
          <Stack direction="row" gap={0.25}>
            <Can resource="categories" action="update">
              <Tooltip title={t("edit")}>
                <IconButton
                  size="small"
                  component={CustomLink}
                  href={`/admin/categories/${row._id}`}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
            <Can resource="categories" action="delete">
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
  const [deleting, setDeleting] = useState<Category | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items ?? []).filter(
      (r) =>
        (!status || (status === "active") === !!r.isActive) &&
        (!term ||
          [r.name.en, r.name.ar, r.slug].some((v) =>
            v?.toLowerCase().includes(term),
          )),
    );
  }, [items, search, status]);

  const chips = [
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
        }}
        filters={
          <FilterSelect
            label={t("status")}
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: t("active") },
              { value: "inactive", label: t("inactive") },
            ]}
          />
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

export default CategoriesPage;
