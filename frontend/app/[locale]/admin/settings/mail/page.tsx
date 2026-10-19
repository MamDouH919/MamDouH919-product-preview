"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Send from "@mui/icons-material/Send";
import { useMailSettingsQuery, MAIL_SETTINGS_QUERY_KEY } from "@/backend-api/settings/hooks";
import { testMailSettings, updateMailSettings } from "@/backend-api/settings/mutations";
import {
  MailEncryption,
  MailNotifications,
  UpdateMailSettingInput,
} from "@/backend-api/settings/types";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";

type Preset = {
  label: string;
  host?: string;
  port?: number;
  encryption?: MailEncryption;
  username?: string;
  /** Translation key for a provider-specific tip. */
  hint?: string;
};

/** Common providers — picking one fills the server fields, which stay editable. */
const PRESETS: Record<string, Preset> = {
  custom: { label: "Custom SMTP" },
  gmail: { label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 465, encryption: "ssl", hint: "mailHintAppPassword" },
  outlook: { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, encryption: "starttls" },
  yahoo: { label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: 465, encryption: "ssl", hint: "mailHintAppPassword" },
  zoho: { label: "Zoho Mail", host: "smtp.zoho.com", port: 465, encryption: "ssl" },
  icloud: { label: "iCloud Mail", host: "smtp.mail.me.com", port: 587, encryption: "starttls", hint: "mailHintAppPassword" },
  hostinger: { label: "Hostinger", host: "smtp.hostinger.com", port: 465, encryption: "ssl" },
  sendgrid: { label: "SendGrid", host: "smtp.sendgrid.net", port: 587, encryption: "starttls", username: "apikey", hint: "mailHintApiKey" },
  mailgun: { label: "Mailgun", host: "smtp.mailgun.org", port: 587, encryption: "starttls" },
  brevo: { label: "Brevo (Sendinblue)", host: "smtp-relay.brevo.com", port: 587, encryption: "starttls" },
  ses: { label: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587, encryption: "starttls", hint: "mailHintSesRegion" },
  mailtrap: { label: "Mailtrap (testing)", host: "sandbox.smtp.mailtrap.io", port: 2525, encryption: "starttls" },
};

const DEFAULT_PORTS: Record<MailEncryption, number> = { ssl: 465, starttls: 587, none: 25 };

const NOTIFICATION_KEYS: (keyof MailNotifications)[] = [
  "customerOrderPlaced",
  "customerOrderStatus",
  "storeNewOrder",
  "storeOrderCancelled",
  "contactForm",
  "customerAbandonedCart",
];

type FormValues = {
  enabled: boolean;
  provider: string;
  host: string;
  port: string;
  encryption: MailEncryption;
  allowInvalidCertificates: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  /** Comma- or line-separated. */
  notificationEmails: string;
  bccEmails: string;
  notifications: MailNotifications;
};

// Letters-only TLD, matching the backend's check (rejects typos like "gmail.com2").
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

const splitEmails = (value: string) =>
  value.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

const MailSettingsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const { data: settings, isLoading } = useMailSettingsQuery();
  const [showPassword, setShowPassword] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [testTo, setTestTo] = useState("");

  const { control, handleSubmit, reset, register, setValue, getValues, watch, formState: { errors } } =
    useForm<FormValues>({
      defaultValues: {
        enabled: false,
        provider: "custom",
        host: "",
        port: "587",
        encryption: "starttls",
        allowInvalidCertificates: false,
        username: "",
        password: "",
        fromName: "",
        fromEmail: "",
        replyTo: "",
        notificationEmails: "",
        bccEmails: "",
        notifications: Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, true])) as MailNotifications,
      },
    });

  const provider = watch("provider");
  const enabled = watch("enabled");
  const hint = PRESETS[provider]?.hint;

  useEffect(() => {
    dispatch(changeBreadCrumbActions({
      breadCrumb: [{ title: t("settings") }, { title: t("mailSettings") }],
    }));
    return () => { dispatch(resetBreadCrumbActions()); };
  }, [dispatch, t]);

  useEffect(() => {
    if (!settings) return;
    reset({
      enabled: settings.enabled,
      provider: settings.provider in PRESETS ? settings.provider : "custom",
      host: settings.host ?? "",
      port: String(settings.port ?? 587),
      encryption: settings.encryption ?? "starttls",
      allowInvalidCertificates: settings.allowInvalidCertificates ?? false,
      username: settings.username ?? "",
      password: "",
      fromName: settings.fromName ?? "",
      fromEmail: settings.fromEmail ?? "",
      replyTo: settings.replyTo ?? "",
      notificationEmails: (settings.notificationEmails ?? []).join(", "),
      bccEmails: (settings.bccEmails ?? []).join(", "),
      notifications: { ...getValues("notifications"), ...settings.notifications },
    });
    setClearPassword(false);
  }, [settings, reset, getValues]);

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset?.host) return;
    setValue("host", preset.host);
    setValue("port", String(preset.port));
    setValue("encryption", preset.encryption!);
    if (preset.username) setValue("username", preset.username);
  };

  const toPayload = (data: FormValues): UpdateMailSettingInput => ({
    enabled: data.enabled,
    provider: data.provider,
    host: data.host.trim(),
    port: Number(data.port),
    encryption: data.encryption,
    allowInvalidCertificates: data.allowInvalidCertificates,
    username: data.username.trim(),
    ...(data.password ? { password: data.password } : {}),
    ...(clearPassword && !data.password ? { clearPassword: true } : {}),
    fromName: data.fromName.trim(),
    fromEmail: data.fromEmail.trim() || null,
    replyTo: data.replyTo.trim() || null,
    notificationEmails: splitEmails(data.notificationEmails),
    bccEmails: splitEmails(data.bccEmails),
    notifications: data.notifications,
  });

  const onError = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error(Array.isArray(message) ? message.join(", ") : message ?? t("somethingWentWrong"));
  };

  const save = useMutation({
    mutationFn: (data: FormValues) => updateMailSettings(toPayload(data)),
    onSuccess: (saved) => {
      toast.success(t("saveSuccessfully"));
      queryClient.setQueryData([MAIL_SETTINGS_QUERY_KEY], saved);
    },
    onError,
  });

  const test = useMutation({
    mutationFn: (data: FormValues) =>
      testMailSettings({ ...toPayload(data), to: testTo.trim() || undefined }),
    onSuccess: (result) => toast.success(t("mailTestSent", { email: result.to })),
    onError,
  });

  const emailListRule = {
    validate: (v: string) => {
      const invalid = splitEmails(v).filter((e) => !EMAIL_RE.test(e));
      return !invalid.length || t("mailInvalidEmailList", { emails: invalid.join(", ") });
    },
  };
  const emailRule = {
    validate: (v: string) => !v.trim() || EMAIL_RE.test(v.trim()) || t("invalidEmail"),
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 300 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const section = (title: string, description?: string) => (
    <>
      <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" mt={0.5}>{description}</Typography>
      )}
      <Divider sx={{ my: 2 }} />
    </>
  );

  return (
    <Box component="form" onSubmit={handleSubmit((d) => save.mutate(d))}>
      <Stack spacing={3}>

        {/* Status */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" fontWeight={700}>{t("mailSettings")}</Typography>
                <Chip
                  size="small"
                  color={settings?.enabled ? "success" : "default"}
                  label={settings?.enabled ? t("mailStatusActive") : t("mailStatusOff")}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {t("mailSettingsDescription")}
              </Typography>
            </Box>
            <Controller
              name="enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label={t("mailEnabled")}
                />
              )}
            />
          </Stack>
          {!enabled && (
            <Alert severity="warning" sx={{ mt: 2 }}>{t("mailDisabledWarning")}</Alert>
          )}
        </Paper>

        {/* Server */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {section(t("mailServer"))}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Controller
                name="provider"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label={t("mailProvider")}
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      applyPreset(e.target.value);
                    }}
                  >
                    {Object.entries(PRESETS).map(([key, p]) => (
                      <MenuItem key={key} value={key}>{p.label}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
              {hint && <Alert severity="info" sx={{ mt: 1.5 }}>{t(hint)}</Alert>}
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                size="small"
                fullWidth
                label={t("mailHost")}
                placeholder="smtp.example.com"
                error={!!errors.host}
                helperText={errors.host?.message}
                {...register("host", {
                  validate: (v) => !getValues("enabled") || !!v.trim() || t("required"),
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label={t("mailPort")}
                slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                error={!!errors.port}
                helperText={errors.port?.message}
                {...register("port", {
                  validate: (v) => (Number(v) >= 1 && Number(v) <= 65535) || t("mailInvalidPort"),
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="encryption"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label={t("mailEncryption")}
                    value={field.value}
                    onChange={(e) => {
                      const next = e.target.value as MailEncryption;
                      field.onChange(next);
                      // Follow the encryption with its usual port, unless the admin set a custom one.
                      const port = Number(getValues("port"));
                      if (Object.values(DEFAULT_PORTS).includes(port)) {
                        setValue("port", String(DEFAULT_PORTS[next]));
                      }
                    }}
                  >
                    <MenuItem value="ssl">{t("mailEncryptionSsl")}</MenuItem>
                    <MenuItem value="starttls">{t("mailEncryptionStarttls")}</MenuItem>
                    <MenuItem value="none">{t("mailEncryptionNone")}</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: "flex", alignItems: "center" }}>
              <Controller
                name="allowInvalidCertificates"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                    label={t("mailAllowInvalidCerts")}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Authentication */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {section(t("mailAuthentication"), t("mailAuthenticationHint"))}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                autoComplete="off"
                label={t("mailUsername")}
                {...register("username")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                label={t("password")}
                placeholder={settings?.hasPassword && !clearPassword ? "••••••••" : ""}
                helperText={
                  settings?.hasPassword && !clearPassword ? t("mailPasswordKeep") : undefined
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword((s) => !s)}>
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                {...register("password")}
              />
              {settings?.hasPassword && (
                <Button
                  size="small"
                  color={clearPassword ? "inherit" : "error"}
                  sx={{ mt: 0.5 }}
                  onClick={() => setClearPassword((c) => !c)}
                >
                  {clearPassword ? t("mailKeepPassword") : t("mailRemovePassword")}
                </Button>
              )}
            </Grid>
          </Grid>
        </Paper>

        {/* Sender */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {section(t("mailSender"), t("mailSenderHint"))}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" fullWidth label={t("mailFromName")} {...register("fromName")} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                size="small"
                fullWidth
                type="email"
                label={t("mailFromEmail")}
                placeholder="orders@yourstore.com"
                error={!!errors.fromEmail}
                helperText={errors.fromEmail?.message}
                {...register("fromEmail", {
                  validate: (v) =>
                    getValues("enabled") && !v.trim() ? t("required") : emailRule.validate(v),
                })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                size="small"
                fullWidth
                type="email"
                label={t("mailReplyTo")}
                helperText={errors.replyTo?.message ?? t("mailReplyToHint")}
                error={!!errors.replyTo}
                {...register("replyTo", emailRule)}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Recipients */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {section(t("mailRecipients"))}
          <Stack spacing={2}>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label={t("mailNotificationEmails")}
              placeholder="owner@yourstore.com, sales@yourstore.com"
              error={!!errors.notificationEmails}
              helperText={errors.notificationEmails?.message ?? t("mailNotificationEmailsHint")}
              {...register("notificationEmails", emailListRule)}
            />
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label={t("mailBccEmails")}
              error={!!errors.bccEmails}
              helperText={errors.bccEmails?.message ?? t("mailBccEmailsHint")}
              {...register("bccEmails", emailListRule)}
            />
          </Stack>
        </Paper>

        {/* Which emails go out */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {section(t("mailNotifications"), t("mailNotificationsHint"))}
          <Stack>
            {NOTIFICATION_KEYS.map((key) => (
              <Controller
                key={key}
                name={`notifications.${key}`}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                    label={t(`mailNotify.${key}`)}
                  />
                )}
              />
            ))}
          </Stack>
        </Paper>

        {/* Test */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          {section(t("mailTest"), t("mailTestHint"))}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              fullWidth
              type="email"
              label={t("mailTestTo")}
              placeholder={watch("fromEmail") || "you@example.com"}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button
              variant="outlined"
              disabled={test.isPending}
              startIcon={test.isPending ? <CircularProgress size={16} /> : <Send />}
              onClick={handleSubmit((d) => test.mutate(d))}
              sx={{ flexShrink: 0 }}
            >
              {t("mailSendTest")}
            </Button>
          </Stack>
        </Paper>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={save.isPending}
          startIcon={save.isPending ? <CircularProgress size={18} /> : null}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("save")}
        </Button>
      </Stack>
    </Box>
  );
};

export default MailSettingsPage;
