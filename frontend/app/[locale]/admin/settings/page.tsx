"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import { useSettingsQuery, SETTINGS_QUERY_KEY } from "@/backend-api/settings/hooks";
import { updateSettings } from "@/backend-api/settings/mutations";
import { getBackendUri } from "@/utils/helperFunctions";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { updateColor } from "@/Store/slices/settings";
import { LocalizedField } from "@/backend-api/globalTypes";
import config from "@/config.json";

const SOCIAL_KEYS = ["FACEBOOK", "INSTAGRAM", "TWITTER", "LINKEDIN", "YOUTUBE", "TIKTOK", "WHATSAPP", "TELEGRAM"];

type SocialItem = { key: string; value: string };

type SettingsFormValues = {
  siteTitle: LocalizedField;
  siteDescription: LocalizedField;
  logo: File | string | null;
  favicon: File | string | null;
  phone: string;
  whatsapp: string;
  landLine: string;
  email: string;
  address: string;
  socialMedia: SocialItem[];
  primaryColor?: string;
};

const LANGS = config.app.languages as string[];

const SettingsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const { data: settings, isLoading } = useSettingsQuery();

  const { control, handleSubmit, reset, register, formState: { errors } } = useForm<SettingsFormValues>({
    defaultValues: {
      siteTitle: Object.fromEntries(LANGS.map((l) => [l, ""])),
      siteDescription: Object.fromEntries(LANGS.map((l) => [l, ""])),
      logo: null,
      favicon: null,
      phone: "",
      whatsapp: "",
      landLine: "",
      email: "",
      address: "",
      socialMedia: [],
      primaryColor: "#1976d2",
    },
  });

  const { fields: socialFields, append: appendSocial, remove: removeSocial } =
    useFieldArray({ control, name: "socialMedia" });

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("settings") }] }));
    return () => { dispatch(resetBreadCrumbActions()); };
  }, [dispatch, t]);

  useEffect(() => {
    if (settings) {
      reset({
        siteTitle: Object.fromEntries(
          LANGS.map((l) => [l, (settings.siteTitle as any)?.[l] || ""])
        ),
        siteDescription: Object.fromEntries(
          LANGS.map((l) => [l, (settings.siteDescription as any)?.[l] || ""])
        ),
        logo: settings.logo ? getBackendUri(settings.logo) : null,
        favicon: settings.favicon ? getBackendUri(settings.favicon) : null,
        phone: settings.phone ?? "",
        whatsapp: settings.whatsapp ?? "",
        landLine: settings.landLine ?? "",
        email: settings.email ?? "",
        address: settings.address ?? "",
        socialMedia: settings.socialMedia ?? [],
        primaryColor: settings.primaryColor ?? "#1976d2",
      });
    }
  }, [settings, reset]);

  const tabHasError = (lang: string) =>
    !!(errors as any).siteTitle?.[lang] || !!(errors as any).siteDescription?.[lang];

  const { mutate, isPending } = useMutation({
    mutationFn: (data: SettingsFormValues) => {
      const formData = new FormData();
      LANGS.forEach((lang) => {
        const title = (data.siteTitle as any)?.[lang];
        const desc = (data.siteDescription as any)?.[lang];
        if (title) formData.append(`siteTitle[${lang}]`, title);
        if (desc) formData.append(`siteDescription[${lang}]`, desc);
      });
      if (data.logo instanceof File) formData.append("logo", data.logo);
      if (data.favicon instanceof File) formData.append("favicon", data.favicon);
      if (data.phone) formData.append("phone", data.phone);
      if (data.whatsapp) formData.append("whatsapp", data.whatsapp);
      if (data.landLine) formData.append("landLine", data.landLine);
      if (data.email) formData.append("email", data.email);
      if (data.address) formData.append("address", data.address);
      if (data.primaryColor) formData.append("primaryColor", data.primaryColor);
      (data.socialMedia ?? []).forEach((item, i) => {
        formData.append(`socialMedia[${i}][key]`, item.key);
        formData.append(`socialMedia[${i}][value]`, item.value);
      });
      return updateSettings(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 300 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit((d) => mutate(d))}>
      <Stack spacing={3}>
        {/* Site Info */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("siteInfo")}
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            {LANGS.map((lang) => (
              <Tab
                key={lang}
                label={t(lang)}
                iconPosition="end"
                icon={tabHasError(lang) ? (
                  <Box
                    component="span"
                    sx={{
                      width: 8, height: 8, borderRadius: "50%",
                      bgcolor: "error.main", display: "inline-block", ml: 0.5,
                    }}
                  />
                ) : undefined}
              />
            ))}
          </Tabs>

          {LANGS.map((lang, i) => (
            <Stack
              key={lang}
              spacing={2}
              sx={{ display: activeTab === i ? "flex" : "none" }}
            >
              <TextInputComponent
                name={`siteTitle.${lang}`}
                label={t("siteTitle")}
                control={control}
              />
              <TextInputComponent
                name={`siteDescription.${lang}`}
                label={t("siteDescription")}
                control={control}
                multiline
                rows={3}
              />
            </Stack>
          ))}
        </Paper>

        {/* Images */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("siteImages")}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {t("logo")}
              </Typography>
              <ImageInput
                name="logo"
                control={control as any}
                imagePath={settings?.logo ? getBackendUri(settings.logo) ?? undefined : undefined}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {t("favicon")}
              </Typography>
              <ImageInput
                name="favicon"
                control={control as any}
                imagePath={settings?.favicon ? getBackendUri(settings.favicon) ?? undefined : undefined}
                accept={{ "image/*": [], "image/x-icon": [".ico"] }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Contact Info */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("contactInfo")}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <TextField
              size="small"
              label={t("phone")}
              placeholder="+966 55 000 0000"
              {...register("phone")}
            />
            <TextField
              size="small"
              label={t("whatsapp")}
              placeholder="+966 55 000 0000"
              {...register("whatsapp")}
            />
            <TextField
              size="small"
              label={t("landLine")}
              placeholder="+966 1 000 0000"
              {...register("landLine")}
            />
            <TextInputComponent
              name="email"
              label={t("email")}
              control={control}
            />
            <TextInputComponent
              name="address"
              label={t("address")}
              control={control}
              multiline
              rows={2}
            />
          </Stack>
        </Paper>

        {/* Social Media */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t("socialMedia")}
            </Typography>
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => appendSocial({ key: "INSTAGRAM", value: "" })}
              variant="outlined"
            >
              {t("add")}
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          {socialFields.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("noSocialMedia")}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {socialFields.map((field, index) => (
                <Stack key={field.id} direction="row" spacing={1.5} alignItems="center">
                  <Select
                    size="small"
                    defaultValue={field.key}
                    {...register(`socialMedia.${index}.key`)}
                    sx={{ minWidth: 150 }}
                  >
                    {SOCIAL_KEYS.map((k) => (
                      <MenuItem key={k} value={k}>{k}</MenuItem>
                    ))}
                  </Select>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="https://..."
                    {...register(`socialMedia.${index}.value`)}
                  />
                  <IconButton color="error" onClick={() => removeSocial(index)} size="small">
                    <Delete />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Appearance */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("appearance")}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Controller
            name="primaryColor"
            control={control}
            render={({ field }) => (
              <Stack spacing={1.5}>
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  {t("primaryColor")}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      border: "2px solid",
                      borderColor: "divider",
                      overflow: "hidden",
                      cursor: "pointer",
                      flexShrink: 0,
                      "& input[type='color']": {
                        width: "200%",
                        height: "200%",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        transform: "translate(-25%, -25%)",
                      },
                    }}
                  >
                    <input
                      type="color"
                      value={field.value ?? "#1976d2"}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        dispatch(updateColor(e.target.value));
                      }}
                    />
                  </Box>
                  <TextField
                    size="small"
                    value={field.value ?? "#1976d2"}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      dispatch(updateColor(e.target.value));
                    }}
                    sx={{ width: 140 }}
                    placeholder="#1976d2"
                  />
                  <Box
                    sx={{
                      flex: 1,
                      height: 44,
                      borderRadius: 1.5,
                      background: field.value ?? "#1976d2",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                </Stack>
              </Stack>
            )}
          />
        </Paper>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} /> : null}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("save")}
        </Button>
      </Stack>
    </Box>
  );
};

export default SettingsPage;
