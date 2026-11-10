"use client";

import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import LanguageTabs from "@/components/LanguageTabs";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createBanner, updateBanner } from "@/backend-api/banners/mutations";
import { BANNERS_QUERY_KEY } from "@/backend-api/banners/hooks";
import { Banner } from "@/backend-api/banners/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type BannerFormValues = {
  image: File | string | null;
  mobileImage: File | string | null;
  title: LocalizedField;
  description: LocalizedField;
  active: boolean;
};

interface BannerFormProps {
  defaultData?: Banner;
}

const LOCALIZED_FIELDS = ["title", "description"] as const;

/** Upload guidance shown above the image inputs; the sizes match the slider frames. */
const BANNER_SIZE_NOTES = [
  "bannerSizeNoteDesktop",
  "bannerSizeNoteMobile",
  "bannerSizeNoteSafeArea",
  "bannerSizeNoteFormat",
] as const;

const BannerForm = ({ defaultData }: BannerFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isEditing = !!defaultData;

  const { control, handleSubmit, register, watch, setValue, formState: { errors } } = useForm<BannerFormValues>({
    defaultValues: {
      image: defaultData?.image ? getBackendUri(defaultData.image) : "",
      mobileImage: defaultData?.mobileImage ? getBackendUri(defaultData.mobileImage) : "",
      title: {
        ar: defaultData?.title?.ar || "",
        en: defaultData?.title?.en || "",
      },
      description: {
        ar: defaultData?.description?.ar || "",
        en: defaultData?.description?.en || "",
      },
      active: defaultData?.active ?? true,
    },
  });

  const activeValue = watch("active");

  const mutation = useMutation({
    mutationFn: async (data: BannerFormValues) => {
      const formData = new FormData();

      if (data.image instanceof File) {
        const compressed = await handleCompression(data.image);
        if (compressed) formData.append("image", compressed);
      }

      if (data.mobileImage instanceof File) {
        const compressed = await handleCompression(data.mobileImage);
        if (compressed) formData.append("mobileImage", compressed);
      } else if (!data.mobileImage && defaultData?.mobileImage) {
        // Cleared in the form: the backend removes it and phones fall back to the main image.
        formData.append("mobileImage", "");
      }

      formData.append("active", String(data.active));

      LOCALIZED_FIELDS.forEach((field) => {
        const val = data[field];
        if (val.ar) formData.append(`${field}[ar]`, val.ar);
        if (val.en) formData.append(`${field}[en]`, val.en);
      });

      if (isEditing) {
        return updateBanner({ id: defaultData._id, data: formData });
      }
      return createBanner(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [BANNERS_QUERY_KEY] });
      router.back();
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const onSubmit = (data: BannerFormValues) => {
    mutation.mutate(data);
  };

  const tabHasError = (lang: string) =>
    LOCALIZED_FIELDS.some((field) => !!(errors as any)[field]?.[lang]);

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={3}>
        <Alert severity="info">
          <AlertTitle>{t("bannerSizeNotesTitle")}</AlertTitle>
          <Box component="ul" sx={{ m: 0, ps: 2.5, "& li": { mb: 0.5 } }}>
            {BANNER_SIZE_NOTES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </Box>
        </Alert>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
          <Stack spacing={1} flex={2}>
            <Typography variant="subtitle2">{t("bannerDesktopImage")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("bannerDesktopImageHint")}
            </Typography>
            <ImageInput
              name="image"
              control={control as any}
              imagePath={defaultData?.image ? getBackendUri(defaultData.image) : ""}
            />
          </Stack>
          <Stack spacing={1} flex={1}>
            <Typography variant="subtitle2">{t("bannerMobileImage")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("bannerMobileImageHint")}
            </Typography>
            <ImageInput
              name="mobileImage"
              control={control as any}
              imagePath={defaultData?.mobileImage ? getBackendUri(defaultData.mobileImage) : ""}
            />
          </Stack>
        </Stack>

        <FormControlLabel
          control={
            <Switch
              checked={activeValue}
              {...register("active")}
              onChange={(e) => setValue("active", e.target.checked)}
            />
          }
          label={t("active")}
        />

        <LanguageTabs hasError={tabHasError}>
          {(lang) =>
            LOCALIZED_FIELDS.map((field) => (
              <TextInputComponent
                key={field}
                name={`${field}.${lang}`}
                label={t(field)}
                control={control}
                required={field === "title"}
                multiline={field === "description"}
                rows={field === "description" ? 4 : undefined}
              />
            ))
          }
        </LanguageTabs>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {t("save")}
        </Button>
      </Stack>
    </Box>
  );
};

export default BannerForm;
