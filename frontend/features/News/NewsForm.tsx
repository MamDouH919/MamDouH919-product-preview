"use client";

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
  TextField,
  Typography,
} from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import Editor from "@/components/TextEditor";
import { createNews, updateNews } from "@/backend-api/news/mutations";
import { NEWS_QUERY_KEY } from "@/backend-api/news/hooks";
import { News } from "@/backend-api/news/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { useNavigation } from "@/Hooks/useNavigation";

type NewsFormValues = {
  title: LocalizedField;
  description: LocalizedField;
  content: LocalizedField;
  publishedAt: string;
  active: boolean;
};

interface NewsFormProps {
  defaultData?: News;
}

const LANGS = ["ar", "en"] as const;
const LOCALIZED_FIELDS = ["title", "description"] as const;

const NewsForm = ({ defaultData }: NewsFormProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const { navigate } = useNavigation();

  const isEditing = !!defaultData;

  const { control, handleSubmit, register, setValue, formState: { errors } } =
    useForm<NewsFormValues>({
      defaultValues: {
        title: {
          ar: defaultData?.title?.ar || "",
          en: defaultData?.title?.en || "",
        },
        description: {
          ar: defaultData?.description?.ar || "",
          en: defaultData?.description?.en || "",
        },
        content: {
          ar: defaultData?.content?.ar || "",
          en: defaultData?.content?.en || "",
        },
        publishedAt: defaultData?.publishedAt
          ? new Date(defaultData.publishedAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        active: defaultData?.active ?? true,
      },
    });

  const activeValue = useWatch({ control, name: "active" });

  const mutation = useMutation({
    mutationFn: async (data: NewsFormValues) => {
      const payload: Record<string, any> = {
        active: data.active,
        publishedAt: data.publishedAt,
      };
      LANGS.forEach((lang) => {
        if (data.title?.[lang]) payload[`title[${lang}]`] = data.title[lang];
        if (data.description?.[lang]) payload[`description[${lang}]`] = data.description[lang];
        if (data.content?.[lang]) payload[`content[${lang}]`] = data.content[lang];
      });

      if (isEditing) {
        return updateNews({ id: defaultData._id, data: { title: data.title, description: data.description, content: data.content, publishedAt: data.publishedAt, active: data.active } });
      }
      return createNews({ title: data.title, description: data.description, content: data.content, publishedAt: data.publishedAt, active: data.active });
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [NEWS_QUERY_KEY] });
      navigate(`/admin/news`);
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

        <TextField
          type="date"
          label={t("publishedAt")}
          InputLabelProps={{ shrink: true }}
          {...register("publishedAt")}
          size="small"
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
                  <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "error.main", display: "inline-block", ml: 0.5 }} />
                ) : undefined
              }
            />
          ))}
        </Tabs>

        {tabs.map((tab, i) => (
          <Stack key={tab.lang} spacing={2} sx={{ display: activeTab === i ? "flex" : "none" }}>
            <TextInputComponent
              name={`title.${tab.lang}`}
              label={t("title")}
              control={control}
              required
            />
            <TextInputComponent
              name={`description.${tab.lang}`}
              label={t("shortDescription")}
              control={control}
              multiline
              rows={3}
            />
            <Box>
              <Typography variant="subtitle2" mb={1}>{t("content")}</Typography>
              <Controller
                name={`content.${tab.lang}` as any}
                control={control}
                render={({ field }) => (
                  <Editor value={field.value} onChange={field.onChange} />
                )}
              />
            </Box>
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

export default NewsForm;
