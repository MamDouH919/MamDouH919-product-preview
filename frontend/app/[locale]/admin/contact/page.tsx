"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import {
  useContactsQuery,
  CONTACT_QUERY_KEY,
} from "@/backend-api/contact/hooks";
import { deleteContact } from "@/backend-api/contact/mutations";
import { Contact } from "@/backend-api/contact/types";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";

const ContactMessagesPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useContactsQuery();

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [CONTACT_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("contactMessages") }],
        breadCrumbBtns: [],
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
        id: "status",
        header: t("status"),
        render: (row: Contact) => (
          <Chip
            label={row.isRead ? t("read") : t("unread")}
            size="small"
            color={row.isRead ? "default" : "info"}
            variant={row.isRead ? "outlined" : "filled"}
          />
        ),
      },
      {
        id: "name",
        header: t("name"),
        render: (row: Contact) => (
          <Stack>
            <Typography variant="body2" fontWeight={row.isRead ? 400 : 700}>
              {row.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              dir="ltr"
              sx={{ textAlign: "start" }}
            >
              {row.email}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "phone",
        header: t("phone"),
        render: (row: Contact) => row.phone || "—",
      },
      {
        id: "subject",
        header: t("subject"),
        render: (row: Contact) => row.subject || "—",
      },
      {
        id: "date",
        header: t("date"),
        render: (row: Contact) =>
          row.createdAt ? new Date(row.createdAt).toLocaleString() : "—",
      },
      {
        id: "actions",
        header: "",
        render: (row: Contact) => (
          <Stack direction="row" gap={0.25}>
            <Tooltip title={t("view")}>
              <IconButton
                size="small"
                component={CustomLink}
                href={`/admin/contact/${row._id}`}
              >
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("delete")}>
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleting(row)}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [t],
  );

  const [search, setSearch] = useState("");
  const [read, setRead] = useState<"read" | "unread">();
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (messages ?? []).filter(
      (m) =>
        (!read || (read === "read") === m.isRead) &&
        (!term ||
          [m.name, m.email, m.phone, m.subject].some((v) =>
            v?.toLowerCase().includes(term),
          )),
    );
  }, [messages, search, read]);

  const chips = [
    ...(read
      ? [{ key: "read", label: t(read), onDelete: () => setRead(undefined) }]
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
          setRead(undefined);
        }}
        filters={
          <FilterSelect
            label={t("status")}
            value={read}
            onChange={setRead}
            options={[
              { value: "unread", label: t("unread") },
              { value: "read", label: t("read") },
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
          onRowClick={(row: Contact) =>
            router.push(`/${lang}/admin/contact/${row._id}`)
          }
        />
      </FilterLayout>
      <ConfirmDialog
        title={deleting ? t("delete") : null}
        message={
          deleting
            ? `${deleting.name} · ${deleting.subject ?? deleting.email}`
            : undefined
        }
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

export default ContactMessagesPage;
