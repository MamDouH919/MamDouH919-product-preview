"use client";

import { use, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useContactByIdQuery, CONTACT_QUERY_KEY } from "@/backend-api/contact/hooks";
import { markContactAsRead } from "@/backend-api/contact/mutations";

interface ContactMessagePageProps {
  params: Promise<{ id: string }>;
}

const ContactMessagePage = ({ params }: ContactMessagePageProps) => {
  const { id } = use(params);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: message, isLoading } = useContactByIdQuery(id);

  const markAsReadMutation = useMutation({
    mutationFn: markContactAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACT_QUERY_KEY] });
    },
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [
          { title: t("contactMessages"), link: `/admin/contact` },
          { title: t("viewMessage") },
        ],
        breadCrumbBtns: [],
      })
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (message && !message.isRead) {
      markAsReadMutation.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.isRead]);

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" height="60vh">
        <CircularProgress />
      </Stack>
    );
  }

  if (!message) {
    return null;
  }

  const fields: { label: string; value?: string }[] = [
    { label: t("name"), value: message.name },
    { label: t("email"), value: message.email },
    { label: t("phone"), value: message.phone },
    { label: t("subject"), value: message.subject },
    {
      label: t("date"),
      value: message.createdAt ? new Date(message.createdAt).toLocaleString() : undefined,
    },
  ];

  return (
    <Box py={3}>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{t("viewMessage")}</Typography>
          <Chip
            label={message.isRead ? t("read") : t("unread")}
            size="small"
            color={message.isRead ? "default" : "info"}
          />
        </Stack>
        <Stack spacing={2}>
          {fields
            .filter((field) => field.value)
            .map((field) => (
              <Stack key={field.label} direction="row" spacing={1}>
                <Typography variant="body2" color="text.secondary" minWidth={100}>
                  {field.label}:
                </Typography>
                <Typography variant="body2">{field.value}</Typography>
              </Stack>
            ))}
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {t("message")}:
            </Typography>
            <Typography variant="body1" whiteSpace="pre-wrap">
              {message.message}
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ContactMessagePage;
