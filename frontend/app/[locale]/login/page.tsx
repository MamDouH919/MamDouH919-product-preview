"use client";
import { useEffect } from 'react';
import { Button, Link as MuiLink, Stack, Typography } from '@mui/material';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TextInputComponent from '@/components/MUI/ControlMUItextField';
import AdminAuthLayout from '@/components/AdminAuthLayout';
import { loginRequest } from '@/backend-api/auth/mutations';
import { setAdminSession } from '@/actions/cookies';
import { setAuthToken } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/Store/store';
import { changeAuthData } from '@/Store/slices/auth';

type FormValues = { email: string; password: string };

const Login = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isInitialized && isLoggedIn) {
      router.replace("/" + i18n.language + "/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoggedIn]);

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: loginRequest,
    onSuccess: async (data) => {
      await setAdminSession(data.accessToken, data.refreshToken);
      setAuthToken(data.accessToken);
      dispatch(changeAuthData({
        isLoggedIn: true,
        isInitialized: true,
        user: { id: data.user._id, name: data.user.name, email: data.user.email },
        role: data.user.roleId ?? "",
        isSuper: data.user.isSuper ?? false,
      }));

      toast.success(t("loginSuccess"));
      router.push("/" + i18n.language + "/admin");
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error(typeof message === "string" ? message : t("wrongCredentials"));
    },
  });

  const onSubmit = (data: FormValues) => mutate({ ...data, email: data.email.trim() });

  return (
    <AdminAuthLayout>
      <Stack spacing={1}>
        <Typography component="h1" variant="h4" fontWeight={700} color="text.primary">
          {t("welcomeBack")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("adminSignInSubtitle")}
        </Typography>
      </Stack>

      <Stack spacing={2.5} component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <TextInputComponent
          label={t("email")}
          control={control}
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          rules={{
            required: t("fieldIsRequired"),
            pattern: { value: /^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/, message: t("invalidEmail") },
          }}
        />
        <Stack spacing={1}>
          <TextInputComponent
            name="password"
            label={t("password")}
            type="password"
            autoComplete="current-password"
            control={control}
            rules={{ required: t("fieldIsRequired") }}
          />
          <MuiLink
            component={Link}
            href={`/${i18n.language}/forgot-password`}
            variant="body2"
            underline="hover"
            sx={{ alignSelf: 'flex-end' }}
          >
            {t("forgotPassword")}
          </MuiLink>
        </Stack>

        <Button
          fullWidth
          size="large"
          variant="contained"
          type="submit"
          loading={isPending}
          loadingPosition="end"
          endIcon={<LoginOutlined sx={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : undefined }} />}
          sx={{ py: 1.25, fontWeight: 700 }}
        >
          {t("signIn")}
        </Button>
      </Stack>
    </AdminAuthLayout>
  );
};

export default Login;
