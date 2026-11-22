"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconButton, Stack, Tooltip } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  deleteSubscriber,
  fetchSubscribers,
  Subscriber,
} from "@/backend-api/subscribe/queries";
import FilterLayout from "@/components/FilterLayout";
import PageActions, { PageActionButton } from "@/components/PageActions";
import SimpleTable from "@/components/Table/SimpleTable";

const SUBSCRIBERS_QUERY_KEY = "subscribers";

/** Quotes a CSV cell, and defuses values a spreadsheet would run as a formula. */
const csvCell = (value: string) => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

const SubscribersPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: [SUBSCRIBERS_QUERY_KEY],
    queryFn: fetchSubscribers,
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("subscribers") }],
        breadCrumbBtns: [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteMutation = useMutation({
    mutationFn: deleteSubscriber,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBSCRIBERS_QUERY_KEY] });
      toast.success(t("deletedSuccessfully"));
    },
    onError: () => toast.error(t("somethingWentWrong")),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter(
      (s) => !term || s.email.toLowerCase().includes(term),
    );
  }, [data, search]);

  const exportCsv = () => {
    const lines = [
      ["email", "name", "subscribed_at"].join(","),
      ...rows.map((s) =>
        [
          s.email,
          [s.firstName, s.lastName].filter(Boolean).join(" "),
          s.createdAt,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    // BOM so Excel opens Arabic names correctly.
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo(
    () => [
      {
        id: "email",
        header: t("email"),
        render: (row: Subscriber) => <span dir="ltr">{row.email}</span>,
      },
      {
        id: "name",
        header: t("name"),
        render: (row: Subscriber) =>
          [row.firstName, row.lastName].filter(Boolean).join(" ") || "—",
      },
      {
        id: "createdAt",
        header: t("subscribedOn"),
        render: (row: Subscriber) =>
          new Date(row.createdAt).toLocaleDateString(
            lang === "ar" ? "ar-EG" : "en-GB",
          ),
      },
      {
        id: "actions",
        header: "",
        render: (row: Subscriber) => (
          <Tooltip title={t("delete")}>
            <IconButton
              size="small"
              color="error"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(row._id)}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [t, lang, deleteMutation],
  );

  return (
    <Stack spacing={2} height="100%">
      <PageActions>
        <PageActionButton
          startIcon={<FileDownloadOutlined />}
          onClick={exportCsv}
          disabled={!rows.length}
        >
          {t("exportCsv")}
        </PageActionButton>
      </PageActions>
      <FilterLayout
        search={{ value: search, onChange: setSearch, placeholder: t("email") }}
        activeCount={search ? 1 : 0}
        chips={
          search
            ? [
                {
                  key: "search",
                  label: `${t("search")}: ${search}`,
                  onDelete: () => setSearch(""),
                },
              ]
            : []
        }
        onClear={() => setSearch("")}
      >
        <SimpleTable
          clientPagination
          columns={columns}
          data={rows}
          height="100%"
          loading={isLoading}
        />
      </FilterLayout>
    </Stack>
  );
};

export default SubscribersPage;
