"use client";

import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Chip, IconButton, Stack } from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import { useContactsQuery, CONTACT_QUERY_KEY } from "@/backend-api/contact/hooks";
import { deleteContact } from "@/backend-api/contact/mutations";
import { Contact } from "@/backend-api/contact/types";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";

const ContactMessagesPage = () => {
  const { t } = useTranslation();
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
        render: (row: Contact) => row.name,
      },
      {
        id: "email",
        header: t("email"),
        render: (row: Contact) => row.email,
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
        header: t("actions"),
        render: (row: Contact) => (
          <Stack direction="row">
            <CustomLink href={`/admin/contact/${row._id}`}>
              <IconButton>
                <Visibility />
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
    [t, deleteMutation]
  );

  return (
    <SimpleTable
      columns={columns}
      data={messages ?? []}
      borderRadius={0}
      height="100%"
      loading={isLoading}
    />
  );
};

export default ContactMessagesPage;
