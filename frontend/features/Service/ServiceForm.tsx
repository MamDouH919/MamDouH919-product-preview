"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
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
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import Editor from "@/components/TextEditor";
import { createService, updateService } from "@/backend-api/services/mutations";
import { SERVICES_QUERY_KEY } from "@/backend-api/services/hooks";
import { Service } from "@/backend-api/services/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type ServiceFormValues = {
  image: File | string | null;
  iconImage: File | string | null;
  title: LocalizedField;
  description: LocalizedField;
  shortDescription: LocalizedField;
  active: boolean;
};

interface ServiceFormProps {
  defaultData?: Service;
}

const LANGS = ["ar", "en"] as const;
const LOCALIZED_FIELDS = ["title", "shortDescription"] as const;

const ServiceForm = ({ defaultData }: ServiceFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  const isEditing = !!defaultData;

  const { control, handleSubmit, register, setValue, formState: { errors } } =
    useForm<ServiceFormValues>({
      defaultValues: {
        image: defaultData?.image ? getBackendUri(defaultData.image) : "",
        iconImage: defaultData?.iconImage ? getBackendUri(defaultData.iconImage) : "",
        title: {
          ar: defaultData?.title?.ar || "",
          en: defaultData?.title?.en || "",
        },
        description: {
          ar: defaultData?.description?.ar || "",
          en: defaultData?.description?.en || "",
        },
        shortDescription: {
          ar: defaultData?.shortDescription?.ar || "",
          en: defaultData?.shortDescription?.en || "",
        },
        active: defaultData?.active ?? true,
      },
    });

  const activeValue = useWatch({ control, name: "active" });


  const mutation = useMutation({
    mutationFn: async (data: ServiceFormValues) => {
      const formData = new FormData();

      if (data.image instanceof File) {
        const compressed = await handleCompression(data.image);
        if (compressed) formData.append("image", compressed);
      }

      if (data.iconImage instanceof File) {
        const compressed = await handleCompression(data.iconImage);
        if (compressed) formData.append("iconImage", compressed);
      }
      formData.append("active", String(data.active));

      LANGS.forEach((lang) => {
        if (data.title?.[lang]) formData.append(`title[${lang}]`, data.title[lang]!);
        if (data.description?.[lang]) formData.append(`description[${lang}]`, data.description[lang]!);
        if (data.shortDescription?.[lang]) formData.append(`shortDescription[${lang}]`, data.shortDescription[lang]!);
      });

      if (isEditing) {
        return updateService({ id: defaultData._id, data: formData });
      }
      return createService(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SERVICES_QUERY_KEY] });
      router.back();
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const tabs = [
    { label: t("arabic"), lang: "ar" },
    { label: t("english"), lang: "en" },
  ];

  const tabHasError = (lang: string) =>
    LOCALIZED_FIELDS.some((field) => !!(errors as any)[field]?.[lang]) ||
    !!(errors as any).description?.[lang];

  // Resolve icon component for preview

  return (
    <Box component="form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Stack spacing={3}>
        <ImageInput
          name="image"
          control={control as any}
          imagePath={defaultData?.image ? getBackendUri(defaultData.image) : ""}
        />

        <ImageInput
          name="iconImage"
          control={control as any}
          imagePath={defaultData?.iconImage ? getBackendUri(defaultData.iconImage) : ""}
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

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
          {tabs.map((tab, i) => (
            <Tab
              key={tab.lang}
              label={tab.label}
              value={i}
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

        {tabs.map((tab, i) => (
          <Stack
            key={tab.lang}
            spacing={2}
            sx={{ display: activeTab === i ? "flex" : "none" }}
          >
            <TextInputComponent
              name={`title.${tab.lang}`}
              label={t("title")}
              control={control}
              required
            />

            <TextInputComponent
              name={`shortDescription.${tab.lang}`}
              label={t("shortDescription")}
              control={control}
              multiline
              rows={3}
            />

            <Grid size={{ xs: 12 }}>
              <Typography variant="h5" mb={1}>{t("description")}</Typography>
              <Controller
                name={`description.${tab.lang}` as any}
                control={control}
                render={({ field, fieldState }) => (
                  <div>
                    <Editor value={field.value} onChange={field.onChange} />
                    {fieldState.error && (
                      <Typography color="error">{fieldState.error.message}</Typography>
                    )}
                  </div>
                )}
              />
            </Grid>
          </Stack>
        ))}

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

export default ServiceForm;
