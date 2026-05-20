"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import MarkEmailReadOutlined from "@mui/icons-material/MarkEmailReadOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useParams } from "next/navigation";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { forgotPasswordRequest } from "@/backend-api/auth/mutations";

type FormValues = { email: string };

const ForgotPasswordPage = () => {
  const { t, i18n } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const lang = locale ?? i18n.language;
  const [submitted, setSubmitted] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: forgotPasswordRequest,
    onSuccess: (_, vars) => {
      setSentEmail(vars.email);
      setSubmitted(true);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(typeof message === "string" ? message : t("somethingWentWrong"));
    },
  });

  return (
    <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
      <Container maxWidth="xs">
        <Stack component={Paper} p={3} spacing={2.5} alignItems="center">
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: submitted ? "success.main" : "primary.main",
              transition: "background-color 0.3s",
            }}
          >
            {submitted ? (
              <MarkEmailReadOutlined fontSize="large" />
            ) : (
              <LockResetOutlined fontSize="large" />
            )}
          </Avatar>

          {submitted ? (
            /* ── Success state ── */
            <Stack spacing={1.5} alignItems="center" textAlign="center">
              <Typography variant="h6" fontWeight={700}>
                {t("checkYourEmail")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("resetLinkSentTo")}{" "}
                <Box component="span" fontWeight={700} color="text.primary">
                  {sentEmail}
                </Box>
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {t("resetLinkExpiry")}
              </Typography>
            </Stack>
          ) : (
            /* ── Form state ── */
            <>
              <Stack spacing={0.5} alignItems="center" textAlign="center">
                <Typography variant="h6" fontWeight={700}>
                  {t("forgotPassword")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("forgotPasswordSubtitle")}
                </Typography>
              </Stack>

              <Stack
                spacing={2}
                component="form"
                sx={{ width: "100%" }}
                onSubmit={handleSubmit((d) => mutate(d))}
              >
                <TextInputComponent
                  label={t("email")}
                  control={control}
                  name="email"
                  rules={{
                    required: t("fieldIsRequired"),
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
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
                >
                  {t("sendResetLink")}
                </Button>
              </Stack>
            </>
          )}

          <Button
            component={Link}
            href={`/${lang}/login`}
            startIcon={<ArrowBackOutlined />}
            size="small"
            sx={{ alignSelf: "center" }}
          >
            {t("backToLogin")}
          </Button>
        </Stack>
      </Container>
    </Stack>
  );
};

export default ForgotPasswordPage;
