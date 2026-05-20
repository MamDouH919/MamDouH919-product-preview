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
  Rating,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createTestimonial, updateTestimonial } from "@/backend-api/testimonials/mutations";
import { TESTIMONIALS_QUERY_KEY } from "@/backend-api/testimonials/hooks";
import { Testimonial } from "@/backend-api/testimonials/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type TestimonialFormValues = {
  image: File | string | null;
  name: LocalizedField;
  job: LocalizedField;
  content: LocalizedField;
  rate: number;
  active: boolean;
};

interface TestimonialFormProps {
  defaultData?: Testimonial;
}

const LANGS = ["ar", "en"] as const;
const LOCALIZED_FIELDS = ["name", "content"] as const;

const TestimonialForm = ({ defaultData }: TestimonialFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  const isEditing = !!defaultData;

  const { control, handleSubmit, register, setValue, formState: { errors } } =
    useForm<TestimonialFormValues>({
      defaultValues: {
        image: defaultData?.image ? getBackendUri(defaultData.image) : "",
        name: {
          ar: defaultData?.name?.ar || "",
          en: defaultData?.name?.en || "",
        },
        job: {
          ar: defaultData?.job?.ar || "",
          en: defaultData?.job?.en || "",
        },
        content: {
          ar: defaultData?.content?.ar || "",
          en: defaultData?.content?.en || "",
        },
        rate: defaultData?.rate ?? 5,
        active: defaultData?.active ?? true,
      },
    });

  const activeValue = useWatch({ control, name: "active" });

  const mutation = useMutation({
    mutationFn: async (data: TestimonialFormValues) => {
      const formData = new FormData();

      if (data.image instanceof File) {
        const compressed = await handleCompression(data.image);
        if (compressed) formData.append("image", compressed);
      }

      formData.append("rate", String(data.rate));
      formData.append("active", String(data.active));

      LANGS.forEach((lang) => {
        if (data.name?.[lang]) formData.append(`name[${lang}]`, data.name[lang]!);
        if (data.job?.[lang]) formData.append(`job[${lang}]`, data.job[lang]!);
        if (data.content?.[lang]) formData.append(`content[${lang}]`, data.content[lang]!);
      });

      if (isEditing) {
        return updateTestimonial({ id: defaultData._id, data: formData });
      }
      return createTestimonial(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [TESTIMONIALS_QUERY_KEY] });
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
    LOCALIZED_FIELDS.some((field) => !!(errors as any)[field]?.[lang]);

  return (
    <Box component="form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
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

        <Box>
          <Typography variant="body2" fontWeight={600} mb={0.5}>
            {t("rate")}
          </Typography>
          <Controller
            name="rate"
            control={control}
            render={({ field }) => (
              <Rating
                value={field.value}
                onChange={(_, val) => field.onChange(val ?? 5)}
                size="large"
              />
            )}
          />
        </Box>

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
              name={`name.${tab.lang}`}
              label={t("name")}
              control={control}
              required
            />

            <TextInputComponent
              name={`job.${tab.lang}`}
              label={t("job")}
              control={control}
            />

            <TextInputComponent
              name={`content.${tab.lang}`}
              label={t("content")}
              control={control}
              multiline
              rows={4}
              required
            />
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

export default TestimonialForm;
