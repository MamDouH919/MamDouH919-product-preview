"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { GATEWAY_SETTINGS_QUERY_KEY, ONLINE_AVAILABLE_QUERY_KEY, useGatewaySettingsQuery } from "@/backend-api/payments/hooks";
import type { GatewaySettings } from "@/backend-api/payments/types";
import { testGatewaySettings, updateGatewaySettings } from "@/backend-api/payments/mutations";
import GatewayPayoutsCard from "@/features/Payments/GatewayPayoutsCard";
import { useStoreModules } from "@/Hooks/useStoreModules";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";

/**
 * The store's payment-gateway account. The fields come from the gateway
 * itself (the API describes them), so adding a gateway needs no change here.
 * Saved secrets are never shown: a blank secret field means "keep it".
 */
const PaymentSettingsForm = ({ settings }: { settings: GatewaySettings }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "ar" || i18n.language === "es" ? i18n.language : "en";
  const queryClient = useQueryClient();
  const { has } = useStoreModules();

  const [provider, setProvider] = useState<string>(settings.provider ?? settings.providers[0]?.id ?? "");
  const [enabled, setEnabled] = useState(settings.enabled);
  // Typed values per gateway, so switching between them doesn't lose what was typed.
  // Plain fields start from what is saved; secrets start blank.
  const [typed, setTyped] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(settings.providers.map((p) => [p.id, { ...p.values }]))
  );

  const current = settings.providers.find((p) => p.id === provider)!;
  const values = typed[provider] ?? {};

  const onError = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error(Array.isArray(message) ? message.join(", ") : (message ?? t("somethingWentWrong")));
  };

  const save = useMutation({
    mutationFn: updateGatewaySettings,
    onSuccess: () => {
      // What was typed is saved now; a secret field goes back to "saved — leave empty to keep".
      setTyped((all) => ({
        ...all,
        [provider]: Object.fromEntries(Object.entries(all[provider] ?? {}).filter(([key]) => !current.fields.find((f) => f.key === key)?.secret)),
      }));
      queryClient.invalidateQueries({ queryKey: [GATEWAY_SETTINGS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ONLINE_AVAILABLE_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
    },
    onError,
  });

  const test = useMutation({
    mutationFn: testGatewaySettings,
    onSuccess: () => toast.success(t("paymentKeysWork")),
    onError,
  });

  const set = (key: string, value: string) =>
    setTyped((all) => ({ ...all, [provider]: { ...(all[provider] ?? {}), [key]: value } }));

  // A required secret is satisfied by a saved value or a freshly typed one.
  const missing = current.fields.filter(
    (f) => f.required && !(values[f.key]?.trim() || (f.secret && current.secretsSet.includes(f.key)))
  );
  const payload = { provider, credentials: values };

  return (
    <Stack spacing={3} maxWidth={760}>
      <Box>
        <Typography variant="h6" fontWeight={700}>
          {t("paymentSettings")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("paymentSettingsDescription")}
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <FormControlLabel
              control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
              label={t("paymentOnlineEnabled")}
            />
            <Chip
              size="small"
              color={settings.enabled && current.complete ? "success" : "default"}
              label={settings.enabled && current.complete ? t("mailStatusActive") : t("paymentNotActive")}
            />
          </Stack>

          {settings.providers.length > 1 && (
            <TextField select label={t("paymentGateway")} value={provider} onChange={(e) => setProvider(e.target.value)}>
              {settings.providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          {current.fields.map((field) => {
            const saved = field.secret && current.secretsSet.includes(field.key);
            return (
              <TextField
                key={field.key}
                label={field.label[lang]}
                required={field.required && !saved}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={saved ? t("paymentSecretSaved") : field.placeholder}
                helperText={field.hint?.[lang]}
                slotProps={{ htmlInput: { dir: "ltr", spellCheck: false } }}
              />
            );
          })}

          <Alert severity="info">
            {t("paymentWebhookNote", { url: `${settings.webhookBase}/${provider}` })}
          </Alert>

          {enabled && missing.length > 0 && (
            <Alert severity="warning">{t("paymentMissing", { fields: missing.map((f) => f.label[lang]).join("، ") })}</Alert>
          )}

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button variant="outlined" disabled={test.isPending || missing.length > 0} onClick={() => test.mutate(payload)}>
              {test.isPending ? <CircularProgress size={18} /> : t("paymentTestKeys")}
            </Button>
            <Button
              variant="contained"
              disabled={save.isPending || (enabled && missing.length > 0)}
              onClick={() => save.mutate({ ...payload, enabled })}
            >
              {save.isPending ? <CircularProgress size={18} color="inherit" /> : t("save")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {has("finance") && <GatewayPayoutsCard />}
    </Stack>
  );
};


const PaymentSettingsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: settings, isLoading } = useGatewaySettingsQuery();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("settings") }, { title: t("paymentSettings") }] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
  }, [dispatch, t]);

  if (isLoading || !settings) {
    return (
      <Stack alignItems="center" py={8}>
        <CircularProgress />
      </Stack>
    );
  }
  return <PaymentSettingsForm settings={settings} />;
};

export default PaymentSettingsPage;
