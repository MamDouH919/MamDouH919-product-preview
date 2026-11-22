"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SECTIONS_QUERY_KEY,
  useSectionsQuery,
} from "@/backend-api/sections/hooks";
import { toggleSectionActive } from "@/backend-api/sections/mutations";
import { Section } from "@/backend-api/sections/types";
import { getBackendUri } from "@/utils/helperFunctions";
import { IconButton, Stack, Switch, Tooltip, Typography } from "@mui/material";
import Edit from "@mui/icons-material/Edit";
import CustomLink from "@/components/CustomLink";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import SimpleTable from "@/components/Table/SimpleTable";
import Thumb from "@/components/Table/Thumb";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const getNestedValue = (obj: any, path: string) => {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
};

const SectionsList = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isSuper = useAppSelector((state) => state.auth.isSuper);
  const lang = i18n.language;

  const { data: sections, isLoading } = useSectionsQuery();

  const sectionsData = useMemo(
    () =>
      sections?.map((section: Section) => ({ ...section, id: section._id })) ??
      [],
    [sections],
  );

  const toggleActiveMutation = useMutation({
    mutationFn: toggleSectionActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SECTIONS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("sections") }],
        breadCrumbBtns: isSuper
          ? [
              {
                title: t("createSection"),
                icon: "add",
                link: `/${i18n.language}/admin/sections/create`,
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
        id: "sectionName",
        header: t("sectionName"),
        render: (row: any) => (
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Thumb
              src={getBackendUri(getNestedValue(row, "image"))}
              alt={row.sectionName || ""}
              width={72}
              height={44}
            />
            <Typography variant="body2" fontWeight={600} noWrap>
              {row.sectionName || ""}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "title",
        header: t("title"),
        render: (row: any) =>
          getNestedValue(row, `title.${lang}`) ||
          getNestedValue(row, "title.en") ||
          "",
      },
      {
        id: "active",
        header: t("active"),
        render: (row: any) => (
          <Switch
            checked={row.active !== false}
            onChange={(e) =>
              toggleActiveMutation.mutate({
                id: row._id,
                active: e.target.checked,
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
        render: (row: any) => (
          <Tooltip title={t("edit")}>
            <IconButton
              size="small"
              component={CustomLink}
              href={`/admin/sections/${row._id}`}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [t, lang, toggleActiveMutation],
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">();
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sectionsData.filter(
      (r) =>
        (!status || (status === "active") === (r.active !== false)) &&
        (!term ||
          [r.sectionName, r.title?.en, r.title?.ar].some((v) =>
            v?.toLowerCase().includes(term),
          )),
    );
  }, [sectionsData, search, status]);

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
  );
};

export default SectionsList;
