"use client";
import { useEffect, useState } from 'react';
import { Avatar, Button, Container, IconButton, Paper, Stack, Typography } from '@mui/material';
import { styled } from "@mui/material/styles";
import LockOutlined from '@mui/icons-material/LockOutlined';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TextInputComponent from '@/components/MUI/ControlMUItextField';
import { loginRequest } from '@/backend-api/auth/mutations';
import { setTokenInCookie } from '@/actions/cookies';
import { setAuthToken } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/Store/store';
import { changeAuthData } from '@/Store/slices/auth';

const PREFIX = "Login";
const classes = {
  avatar: `${PREFIX}-avatar`,
  form: `${PREFIX}-form`,
};

const Root = styled(Stack)(({ theme }) => ({
  height: "100%",
  [`& .${classes.avatar}`]: {
    margin: theme.spacing(1),
    width: theme.spacing(6),
    height: theme.spacing(6),
    backgroundColor: theme.palette.primary.main,
  },
  [`& .${classes.form}`]: {
    width: "100%",
  },
}));

type FormValues = { email: string; password: string };

const Login = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.auth);
  const [passType, setPassType] = useState("password");

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
      await setTokenInCookie(data.accessToken);
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

  const onSubmit = (data: FormValues) => mutate(data);

  return (
    <Root alignItems="center" justifyContent="center">
      <Container maxWidth="xs">
        <Stack component={Paper} p={2} spacing={2} alignItems="center">
          <Avatar className={classes.avatar}>
            <LockOutlined fontSize="large" />
          </Avatar>
          <Typography component="h1" variant="h5" color="text.primary">
            {t("login")}
          </Typography>

          <Stack spacing={2} component="form" className={classes.form} onSubmit={handleSubmit(onSubmit)}>
            <TextInputComponent
              label={t("email")}
              control={control}
              name="email"
              rules={{ required: t("fieldIsRequired") }}
            />
            <TextInputComponent
              name="password"
              label={t("password")}
              type={passType}
              control={control}
              rules={{ required: t("fieldIsRequired") }}
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton size="small" onClick={() => setPassType(passType === "password" ? "text" : "password")}>
                      {passType === "password"
                        ? <VisibilityOff color="primary" fontSize="inherit" />
                        : <Visibility color="primary" fontSize="inherit" />}
                    </IconButton>
                  ),
                },
              }}
            />
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="primary"
              type="submit"
              loading={isPending}
              loadingPosition="end"
              endIcon={<LoginOutlined />}
            >
              {t("login")}
            </Button>
            <Button
              component={Link}
              href={`/${i18n.language}/forgot-password`}
              size="small"
              sx={{ alignSelf: "flex-end", textTransform: "none" }}
            >
              {t("forgotPassword")}?
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Root>
  );
};

export default Login;
