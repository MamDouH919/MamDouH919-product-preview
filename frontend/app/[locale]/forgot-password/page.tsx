"use client";

import { useState } from "react";
import { Avatar, Box, Button, Link as MuiLink, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import MarkEmailReadOutlined from "@mui/icons-material/MarkEmailReadOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useParams } from "next/navigation";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import AdminAuthLayout from "@/components/AdminAuthLayout";
import { forgotPasswordRequest } from "@/backend-api/auth/mutations";

type FormValues = { email: string };

const ForgotPasswordPage = () => {
  const { t, i18n } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const lang = locale ?? i18n.language;
  const isRtl = i18n.dir() === "rtl";
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: forgotPasswordRequest,
    onSuccess: (_, vars) => {
      if (sentEmail === vars.email) toast.success(t("resetLinkResent"));
      setSentEmail(vars.email);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(typeof message === "string" ? message : t("somethingWentWrong"));
    },
  });

  const backToLogin = (
    <MuiLink
      component={Link}
      href={`/${lang}/login`}
      variant="body2"
      underline="hover"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, alignSelf: "center" }}
    >
      <ArrowBackOutlined fontSize="small" sx={{ transform: isRtl ? "scaleX(-1)" : undefined }} />
      {t("backToLogin")}
    </MuiLink>
  );

  return (
    <AdminAuthLayout>
      {sentEmail ? (
        /* ── Sent ── */
        <>
          <Stack spacing={2.5}>
            <Avatar
              sx={(theme) => ({
                width: 56,
                height: 56,
                color: "success.main",
                bgcolor: alpha(theme.palette.success.main, 0.12),
              })}
            >
              <MarkEmailReadOutlined fontSize="large" />
            </Avatar>
            <Stack spacing={1}>
              <Typography component="h1" variant="h4" fontWeight={700} color="text.primary">
                {t("checkYourEmail")}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t("resetLinkSentTo")}{" "}
                <Box component="span" fontWeight={700} color="text.primary" sx={{ wordBreak: "break-all" }}>
                  {sentEmail}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("resetLinkExpiry")}
              </Typography>
            </Stack>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("didntGetEmail")}
            </Typography>
            <Button
              fullWidth
              size="large"
              variant="outlined"
              loading={isPending}
              onClick={() => mutate({ email: sentEmail })}
              sx={{ py: 1.25, fontWeight: 700 }}
            >
              {t("resendLink")}
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => setSentEmail(null)}
              sx={{ textTransform: "none" }}
            >
              {t("useDifferentEmail")}
            </Button>
          </Stack>

          {backToLogin}
        </>
      ) : (
        /* ── Request ── */
        <>
          <Stack spacing={1}>
            <Typography component="h1" variant="h4" fontWeight={700} color="text.primary">
              {t("forgotPassword")}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t("forgotPasswordSubtitle")}
            </Typography>
          </Stack>

          <Stack
            spacing={2.5}
            component="form"
            noValidate
            onSubmit={handleSubmit((d) => mutate({ email: d.email.trim() }))}
          >
            <TextInputComponent
              label={t("email")}
              control={control}
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              rules={{
                required: t("fieldIsRequired"),
                pattern: {
                  value: /^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/,
                  message: t("invalidEmail"),
                },
              }}
            />
            <Button
              fullWidth
              size="large"
              variant="contained"
              type="submit"
              loading={isPending}
              loadingPosition="end"
              endIcon={<SendOutlined sx={{ transform: isRtl ? "scaleX(-1)" : undefined }} />}
              sx={{ py: 1.25, fontWeight: 700 }}
            >
              {t("sendResetLink")}
            </Button>
          </Stack>

          {backToLogin}
        </>
      )}
    </AdminAuthLayout>
  );
};

export default ForgotPasswordPage;
