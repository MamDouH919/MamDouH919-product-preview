"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Stack, Typography } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import CustomLink from "@/components/CustomLink";
import CustomerAuthCard from "@/features/Customer/CustomerAuthCard";
import { registerCustomer } from "@/backend-api/customers/mutations";
import { setCustomerTokenInCookie } from "@/actions/cookies";
import { setCustomerAuthToken } from "@/lib/customerApi";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { setCustomer } from "@/Store/slices/customer";

type FormValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

const SERVER_FIELDS: (keyof FormValues)[] = ["name", "email", "phone", "password"];

const CustomerRegisterPage = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.customer);

  useEffect(() => {
    if (isInitialized && isLoggedIn) {
      router.replace(`/${i18n.language}/account`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoggedIn]);

  const { control, handleSubmit, watch, setError } = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: registerCustomer,
    onSuccess: async (data) => {
      // Registration signs the customer straight in — no email verification
      // stands between them and placing an order.
      await setCustomerTokenInCookie(data.accessToken);
      setCustomerAuthToken(data.accessToken);
      dispatch(setCustomer(data.customer));
      toast.success(t("accountCreated"));
      router.replace(`/${i18n.language}/account`);
    },
    onError: (error: any) => {
      // The email belongs to a guest checkout; the server emailed them a link
      // to activate it instead of letting anyone set its password here.
      if (error?.response?.data?.code === "activation_sent") {
        toast.success(t("guestEmailActivationSent"), { duration: 8000 });
        return;
      }
      const message = error?.response?.data?.message;
      const messages: string[] = Array.isArray(message)
        ? message
        : message
          ? [message]
          : [];

      // Backend messages start with the field name ("email must be an email",
      // "Email already in use"), so route each one under its input.
      const unmatched = messages.filter((msg) => {
        const field = msg.split(" ")[0]?.toLowerCase() as keyof FormValues;
        if (!SERVER_FIELDS.includes(field)) return true;
        setError(field, { type: "server", message: msg }, { shouldFocus: true });
        return false;
      });

      if (unmatched.length || !messages.length) {
        toast.error(unmatched[0] ?? t("somethingWentWrong"));
      }
    },
  });

  return (
    <CustomerAuthCard title={t("createAccount")} subtitle={t("registerSubtitle")}>
      <form
        onSubmit={handleSubmit(({ confirmPassword, phone, ...data }) =>
          mutate({ ...data, phone: phone || undefined, locale: i18n.language })
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
          <TextInputComponent
            name="email"
            label={t("email")}
            control={control}
            type="email"
            required
            rules={{ required: true }}
          />
          <TextInputComponent name="phone" label={t("phone")} control={control} />
          <TextInputComponent
            name="password"
            label={t("password")}
            control={control}
            type="password"
            required
            rules={{
              required: true,
              minLength: { value: 6, message: t("passwordTooShort") },
              deps: ["confirmPassword"],
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
                value === watch("password") || t("passwordsDoNotMatch"),
            }}
          />

          <Button type="submit" variant="contained" size="large" disabled={isPending}>
            {t("createAccount")}
          </Button>

          <Stack direction="row" spacing={0.5} justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              {t("alreadyHaveAccount")}
            </Typography>
            <CustomLink href="/account/login">
              <Typography variant="body2" color="primary" fontWeight={700}>
                {t("signIn")}
              </Typography>
            </CustomLink>
          </Stack>
        </Stack>
      </form>
    </CustomerAuthCard>
  );
};

export default CustomerRegisterPage;
