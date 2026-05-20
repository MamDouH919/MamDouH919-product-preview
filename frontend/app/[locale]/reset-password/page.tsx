"use client";

import { useState } from "react";
import {
  Avatar,
  Button,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { resetPasswordRequest } from "@/backend-api/auth/mutations";

type FormValues = { newPassword: string; confirmPassword: string };

const ResetPasswordPage = () => {
  const { t, i18n } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const lang = locale ?? i18n.language;
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const { control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) =>
      resetPasswordRequest({ token, newPassword: data.newPassword }),
    onSuccess: () => setDone(true),
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(typeof message === "string" ? message : t("somethingWentWrong"));
    },
  });

  if (!token) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
        <Container maxWidth="xs">
          <Stack component={Paper} p={3} spacing={2} alignItems="center" textAlign="center">
            <Typography variant="h6" color="error">{t("invalidResetToken")}</Typography>
            <Button component={Link} href={`/${lang}/forgot-password`} variant="outlined">
              {t("requestNewLink")}
            </Button>
          </Stack>
        </Container>
      </Stack>
    );
  }

  return (
    <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
      <Container maxWidth="xs">
        <Stack component={Paper} p={3} spacing={2.5} alignItems="center">
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: done ? "success.main" : "primary.main",
              transition: "background-color 0.3s",
            }}
          >
            {done ? (
              <CheckCircleOutlined fontSize="large" />
            ) : (
              <LockResetOutlined fontSize="large" />
            )}
          </Avatar>

          {done ? (
            <Stack spacing={1.5} alignItems="center" textAlign="center">
              <Typography variant="h6" fontWeight={700}>
                {t("passwordResetSuccess")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("passwordResetSuccessText")}
              </Typography>
              <Button
                component={Link}
                href={`/${lang}/login`}
                variant="contained"
                fullWidth
              >
                {t("login")}
              </Button>
            </Stack>
          ) : (
            <>
              <Stack spacing={0.5} alignItems="center" textAlign="center">
                <Typography variant="h6" fontWeight={700}>
                  {t("resetPassword")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("resetPasswordSubtitle")}
                </Typography>
              </Stack>

              <Stack
                spacing={2}
                component="form"
                sx={{ width: "100%" }}
                onSubmit={handleSubmit((d) => mutate(d))}
              >
                <TextInputComponent
                  name="newPassword"
                  label={t("newPassword")}
                  type={showPass ? "text" : "password"}
                  control={control}
                  rules={{ required: t("fieldIsRequired"), minLength: { value: 6, message: t("passwordMinLength") } }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton size="small" onClick={() => setShowPass((v) => !v)}>
                          {showPass ? <VisibilityOff fontSize="inherit" /> : <Visibility fontSize="inherit" />}
                        </IconButton>
                      ),
                    },
                  }}
                />
                <TextInputComponent
                  name="confirmPassword"
                  label={t("confirmPassword")}
                  type={showConfirm ? "text" : "password"}
                  control={control}
                  rules={{
                    required: t("fieldIsRequired"),
                    validate: (v: any) => v === watch("newPassword") || t("passwordsDoNotMatch"),
                  }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton size="small" onClick={() => setShowConfirm((v) => !v)}>
                          {showConfirm ? <VisibilityOff fontSize="inherit" /> : <Visibility fontSize="inherit" />}
                        </IconButton>
                      ),
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
                  {t("resetPassword")}
                </Button>
              </Stack>
            </>
          )}

          {!done && (
            <Button
              component={Link}
              href={`/${lang}/login`}
              startIcon={<ArrowBackOutlined />}
              size="small"
            >
              {t("backToLogin")}
            </Button>
          )}
        </Stack>
      </Container>
    </Stack>
  );
};

export default ResetPasswordPage;
