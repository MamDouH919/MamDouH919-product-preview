"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Divider, Paper, Stack, Typography } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import {
  CUSTOMER_ME_QUERY_KEY,
  useCustomerProfileQuery,
} from "@/backend-api/customers/hooks";
import {
  customerChangePassword,
  updateCustomerProfile,
} from "@/backend-api/customers/mutations";
import { useAppDispatch } from "@/Store/store";
import { setCustomer } from "@/Store/slices/customer";

type ProfileValues = { name: string; phone: string; email: string };
type PasswordValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const AccountProfilePage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: customer } = useCustomerProfileQuery();

  const { control, handleSubmit, reset } = useForm<ProfileValues>({
    defaultValues: { name: "", phone: "", email: "" },
  });

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    watch,
    reset: resetPassword,
  } = useForm<PasswordValues>({
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!customer) return;
    reset({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email,
    });
  }, [customer, reset]);

  const profileMutation = useMutation({
    mutationFn: updateCustomerProfile,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_ME_QUERY_KEY] });
      dispatch(setCustomer(updated));
      toast.success(t("saveSuccessfully"));
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  const passwordMutation = useMutation({
    mutationFn: customerChangePassword,
    onSuccess: () => {
      resetPassword();
      toast.success(t("passwordChanged"));
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={0.5}>
          {t("myProfile")}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t("profileSubtitle")}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <form
          onSubmit={handleSubmit(({ name, phone }) =>
            profileMutation.mutate({ name, phone: phone || undefined })
          )}
        >
          <Stack spacing={2.5}>
            <TextInputComponent
              name="name"
              label={t("fullName")}
              control={control}
              required
              rules={{ required: true }}
            />
            {/* Email is the login identity — changing it needs a verification
                round-trip, so it is shown but not editable. */}
            <TextInputComponent
              name="email"
              label={t("email")}
              control={control}
              readOnly
              helperText={t("emailCannotBeChanged")}
            />
            <TextInputComponent name="phone" label={t("phone")} control={control} />

            <Stack direction="row" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={profileMutation.isPending}
              >
                {t("save")}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={3}>
          {t("changePassword")}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <form
          onSubmit={handlePasswordSubmit(({ oldPassword, newPassword }) =>
            passwordMutation.mutate({ oldPassword, newPassword })
          )}
        >
          <Stack spacing={2.5}>
            <TextInputComponent
              name="oldPassword"
              label={t("currentPassword")}
              control={passwordControl}
              type="password"
              required
              rules={{ required: true }}
            />
            <TextInputComponent
              name="newPassword"
              label={t("newPassword")}
              control={passwordControl}
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
              control={passwordControl}
              type="password"
              required
              rules={{
                required: true,
                validate: (value: string) =>
                  value === watch("newPassword") || t("passwordsDoNotMatch"),
              }}
            />

            <Stack direction="row" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={passwordMutation.isPending}
              >
                {t("changePassword")}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
};

export default AccountProfilePage;
