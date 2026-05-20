"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
} from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createBanner, updateBanner } from "@/backend-api/banners/mutations";
import { BANNERS_QUERY_KEY } from "@/backend-api/banners/hooks";
import { Banner } from "@/backend-api/banners/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type BannerFormValues = {
  image: File | string | null;
  title: LocalizedField;
  description: LocalizedField;
  active: boolean;
};

interface BannerFormProps {
  defaultData?: Banner;
}

const LOCALIZED_FIELDS = ["title", "description"] as const;

const BannerForm = ({ defaultData }: BannerFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  const isEditing = !!defaultData;

  const { control, handleSubmit, register, watch, setValue, formState: { errors } } = useForm<BannerFormValues>({
    defaultValues: {
      image: defaultData?.image ? getBackendUri(defaultData.image) : "",
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

  const tabs = [
    { label: t("arabic"), value: 0, lang: "arabic" },
    { label: t("english"), value: 1, lang: "english" },
  ];

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={3}>
        <ImageInput
          name="image"
          control={control as any}
          imagePath={defaultData?.image ? getBackendUri(defaultData.image) : ""}
        />

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

        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              iconPosition="end"
              icon={
                tabHasError(tab.lang) ? (
                  <Box
                    component="span"
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "error.main",
                      display: "inline-block",
                      ml: 0.5,
                    }}
                  />
                ) : undefined
              }
            />
          ))}
        </Tabs>

        <Stack spacing={2} sx={{ display: activeTab === 0 ? "block" : "none" }}>
          {LOCALIZED_FIELDS.map((field) => (
            <TextInputComponent
              key={field}
              name={`${field}.ar`}
              label={t(field)}
              control={control}
              required={field === "title"}
              multiline={field === "description"}
              rows={field === "description" ? 4 : undefined}
            />
          ))}
        </Stack>

        <Stack spacing={2} sx={{ display: activeTab === 1 ? "block" : "none" }}>
          {LOCALIZED_FIELDS.map((field) => (
            <TextInputComponent
              key={field}
              name={`${field}.en`}
              label={t(field)}
              control={control}
              required={field === "title"}
              multiline={field === "description"}
              rows={field === "description" ? 4 : undefined}
            />
          ))}
        </Stack>

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
