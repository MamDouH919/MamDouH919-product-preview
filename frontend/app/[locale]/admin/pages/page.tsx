"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import ContentCopy from "@mui/icons-material/ContentCopy";
import OpenInNew from "@mui/icons-material/OpenInNew";
import SimpleTable from "@/components/Table/SimpleTable";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import CustomLink from "@/components/CustomLink";
import { usePagesQuery, PAGES_QUERY_KEY } from "@/backend-api/pages/hooks";
import {
  deletePage,
  duplicatePage,
  updatePage,
} from "@/backend-api/pages/mutations";
import { Page } from "@/backend-api/pages/types";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useAppDispatch } from "@/Store/store";

const localized = (
  field: Record<string, string | undefined> | undefined,
  lang: string,
) => (field ? field[lang] || field.ar || field.en || "" : "");

const PagesList = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;
  const [toDelete, setToDelete] = useState<Page | null>(null);

  const { data: pages, isLoading } = usePagesQuery();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [PAGES_QUERY_KEY] });
  const onError = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error(
      typeof message === "string" ? message : t("somethingWentWrong"),
    );
  };

  const updateMutation = useMutation({
    mutationFn: updatePage,
    onSuccess: invalidate,
    onError,
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicatePage,
    onSuccess: () => {
      toast.success(t("pageDuplicated"));
      invalidate();
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePage,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("pages") }],
        breadCrumbBtns: [
          {
            title: t("createPage"),
            icon: "add",
            link: `/${i18n.language}/admin/pages/create`,
          },
        ],
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
        id: "title",
        header: t("title"),
        render: (row: Page) => (
          <Stack>
            <Typography fontWeight={600} fontSize={14}>
              {localized(row.title, lang)}
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
        ),
      },
      {
        id: "status",
        header: t("status"),
        render: (row: Page) => (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Switch
              size="small"
              checked={row.isPublished}
              disabled={updateMutation.isPending}
              onChange={(e) =>
                updateMutation.mutate({
                  id: row._id,
                  data: { isPublished: e.target.checked },
                })
              }
            />
            <Chip
              size="small"
              color={row.isPublished ? "success" : "default"}
              label={row.isPublished ? t("published") : t("draft")}
            />
          </Stack>
        ),
      },
      {
        id: "menus",
        header: t("menus"),
        render: (row: Page) => (
          <Stack direction="row" spacing={0.5}>
            {row.showInHeader && (
              <Chip size="small" variant="outlined" label={t("header")} />
            )}
            {row.showInFooter && (
              <Chip size="small" variant="outlined" label={t("footer")} />
            )}
            {!row.showInHeader && !row.showInFooter && (
              <Typography variant="caption" color="text.disabled">
                —
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        id: "updatedAt",
        header: t("lastUpdated"),
        render: (row: Page) =>
          row.updatedAt
            ? new Date(row.updatedAt).toLocaleDateString(
                lang === "ar" ? "ar-EG" : "en-GB",
              )
            : "",
      },
      {
        id: "actions",
        header: "",
        render: (row: Page) => (
          <Stack direction="row">
            <Tooltip title={t("edit")}>
              <span>
                <CustomLink href={`/admin/pages/${row._id}`}>
                  <IconButton size="small">
                    <Edit fontSize="small" />
                  </IconButton>
                </CustomLink>
              </span>
            </Tooltip>
            <Tooltip title={t("viewPage")}>
              <span>
                <IconButton
                  href={`/${lang}/${row.slug}`}
                  target="_blank"
                  size="small"
                  disabled={!row.isPublished}
                >
                  <OpenInNew fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t("duplicate")}>
              <span>
                <IconButton
                  onClick={() => duplicateMutation.mutate(row._id)}
                  disabled={duplicateMutation.isPending}
                  size="small"
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t("delete")}>
              <IconButton
                size="small"
                color="error"
                onClick={() => setToDelete(row)}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [t, lang, updateMutation, duplicateMutation],
  );

  const [search, setSearch] = useState("");
  const [state, setState] = useState<"published" | "draft">();
  const [menu, setMenu] = useState<"header" | "footer">();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (pages ?? []).filter(
      (p) =>
        (!state || (state === "published") === p.isPublished) &&
        (!menu || (menu === "header" ? p.showInHeader : p.showInFooter)) &&
        (!term ||
          [p.title?.en, p.title?.ar, p.slug].some((v) =>
            v?.toLowerCase().includes(term),
          )),
    );
  }, [pages, search, state, menu]);

  const chips = [
    ...(state
      ? [{ key: "state", label: t(state), onDelete: () => setState(undefined) }]
      : []),
    ...(menu
      ? [{ key: "menu", label: t(menu), onDelete: () => setMenu(undefined) }]
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
          setState(undefined);
          setMenu(undefined);
        }}
        filters={
          <>
            <FilterSelect
              label={t("status")}
              value={state}
              onChange={setState}
              options={[
                { value: "published", label: t("published") },
                { value: "draft", label: t("draft") },
              ]}
            />
            <FilterSelect
              label={t("menus")}
              value={menu}
              onChange={setMenu}
              options={[
                { value: "header", label: t("header") },
                { value: "footer", label: t("footer") },
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

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>{t("deletePage")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("deletePageConfirm", {
              title: localized(toDelete?.title, lang),
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>{t("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => toDelete && deleteMutation.mutate(toDelete._id)}
          >
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PagesList;
