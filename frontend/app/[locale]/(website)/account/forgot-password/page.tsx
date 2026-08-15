"use client";

import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Stack, Typography } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import CustomLink from "@/components/CustomLink";
import CustomerAuthCard from "@/features/Customer/CustomerAuthCard";
import { customerForgotPassword } from "@/backend-api/customers/mutations";

const CustomerForgotPasswordPage = () => {
  const { t } = useTranslation();

  const { control, handleSubmit } = useForm<{ email: string }>({
    defaultValues: { email: "" },
  });

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: customerForgotPassword,
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  return (
    <CustomerAuthCard title={t("forgotPassword")} subtitle={t("forgotPasswordSubtitle")}>
      {isSuccess ? (
        // The server answers the same way whether or not the address exists, so
        // the screen must not imply an account was found.
        <Stack spacing={3}>
          <Alert severity="success">{t("resetLinkSent")}</Alert>
          <CustomLink href="/account/login">
            <Button fullWidth variant="outlined">
              {t("backToSignIn")}
            </Button>
          </CustomLink>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit(({ email }) => mutate(email))}>
          <Stack spacing={2.5}>
            <TextInputComponent
              name="email"
              label={t("email")}
              control={control}
              type="email"
              required
              rules={{ required: true }}
            />
            <Button type="submit" variant="contained" size="large" disabled={isPending}>
              {t("sendResetLink")}
            </Button>
            <Stack direction="row" justifyContent="center">
              <CustomLink href="/account/login">
                <Typography variant="body2" color="primary">
                  {t("backToSignIn")}
                </Typography>
              </CustomLink>
            </Stack>
          </Stack>
        </form>
      )}
    </CustomerAuthCard>
  );
};

export default CustomerForgotPasswordPage;
