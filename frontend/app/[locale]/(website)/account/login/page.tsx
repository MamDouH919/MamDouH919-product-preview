"use client";

import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Stack, Typography } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import CustomLink from "@/components/CustomLink";
import CustomerAuthCard from "@/features/Customer/CustomerAuthCard";
import { loginCustomer } from "@/backend-api/customers/mutations";
import { setCustomerTokenInCookie } from "@/actions/cookies";
import { setCustomerAuthToken } from "@/lib/customerApi";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { setCustomer } from "@/Store/slices/customer";

type FormValues = { email: string; password: string };

const CustomerLoginForm = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.customer);

  // Where checkout sent them from, so they land back on it after signing in.
  const from = searchParams.get("from");

  useEffect(() => {
    if (isInitialized && isLoggedIn) {
      router.replace(from ?? `/${i18n.language}/account`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoggedIn]);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: loginCustomer,
    onSuccess: async (data) => {
      await setCustomerTokenInCookie(data.accessToken);
      setCustomerAuthToken(data.accessToken);
      dispatch(setCustomer(data.customer));
      toast.success(t("welcomeBack"));
      router.replace(from ?? `/${i18n.language}/account`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong"));
    },
  });

  return (
    <CustomerAuthCard title={t("signIn")} subtitle={t("signInSubtitle")}>
      <form onSubmit={handleSubmit((data) => mutate(data))}>
        <Stack spacing={2.5}>
          <TextInputComponent
            name="email"
            label={t("email")}
            control={control}
            type="email"
            required
            rules={{ required: true }}
          />
          <TextInputComponent
            name="password"
            label={t("password")}
            control={control}
            type="password"
            required
            rules={{ required: true }}
          />

          <Stack direction="row" justifyContent="flex-end">
            <CustomLink href="/account/forgot-password">
              <Typography variant="body2" color="primary">
                {t("forgotPassword")}?
              </Typography>
            </CustomLink>
          </Stack>

          <Button type="submit" variant="contained" size="large" disabled={isPending}>
            {t("signIn")}
          </Button>

          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              {t("noAccountYet")}
            </Typography>
            <CustomLink href="/account/register">
              <Typography variant="body2" color="primary" fontWeight={700}>
                {t("createAccount")}
              </Typography>
            </CustomLink>
          </Stack>
        </Stack>
      </form>
    </CustomerAuthCard>
  );
};

/** `useSearchParams` needs a Suspense boundary in the App Router. */
const CustomerLoginPage = () => (
  <Suspense>
    <CustomerLoginForm />
  </Suspense>
);

export default CustomerLoginPage;
