"use client";

import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, Stack } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import CustomLink from "@/components/CustomLink";
import CustomerAuthCard from "@/features/Customer/CustomerAuthCard";
import { customerResetPassword } from "@/backend-api/customers/mutations";

type FormValues = { newPassword: string; confirmPassword: string };

const ResetPasswordForm = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // The same token mechanism activates an account a guest checkout created.
  const activating = searchParams.get("activate") === "1";

  const { control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: customerResetPassword,
    onSuccess: () => {
      toast.success(t(activating ? "accountActivated" : "passwordResetSuccess"));
      router.replace(`/${i18n.language}/account/login`);
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  if (!token) {
    return (
      <CustomerAuthCard title={t("resetPassword")}>
        <Stack spacing={3}>
          <Alert severity="error">{t("invalidResetLink")}</Alert>
          <CustomLink href="/account/forgot-password">
            <Button fullWidth variant="outlined">
              {t("requestNewLink")}
            </Button>
          </CustomLink>
        </Stack>
      </CustomerAuthCard>
    );
  }

  return (
    <CustomerAuthCard
      title={t(activating ? "activateAccount" : "resetPassword")}
      subtitle={t(activating ? "activateAccountSubtitle" : "resetPasswordSubtitle")}
    >
      <form
        onSubmit={handleSubmit(({ newPassword }) => mutate({ token, newPassword }))}
      >
        <Stack spacing={2.5}>
          <TextInputComponent
            name="newPassword"
            label={t("newPassword")}
            control={control}
            type="password"
            required
            rules={{
              required: true,
              minLength: { value: 6, message: t("passwordTooShort") },
            }}
          />
          <TextInputComponent
            name="confirmPassword"
            label={t("confirmPassword")}
            control={control}
            type="password"
            required
            rules={{
              required: true,
              validate: (value: string) =>
                value === watch("newPassword") || t("passwordsDoNotMatch"),
            }}
          />
          <Button type="submit" variant="contained" size="large" disabled={isPending}>
            {t(activating ? "activateAccount" : "resetPassword")}
          </Button>
        </Stack>
      </form>
    </CustomerAuthCard>
  );
};

/** `useSearchParams` needs a Suspense boundary in the App Router. */
const CustomerResetPasswordPage = () => (
  <Suspense>
    <ResetPasswordForm />
  </Suspense>
);

export default CustomerResetPasswordPage;
