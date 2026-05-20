"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import Editor from "@/components/TextEditor";
import { createSection, updateSection } from "@/backend-api/sections/mutations";
import { SECTIONS_QUERY_KEY } from "@/backend-api/sections/hooks";
import { Section, SectionType } from "@/backend-api/sections/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";
import { useAppSelector } from "@/Store/store";

const LANGS = ["ar", "en"] as const;

type HighlightFormItem = {
  key: LocalizedField;
  value: string;
  image: File | string | null;
};

type GalleryFormItem = {
  image: File | string | null;
};

type LinkFormItem = {
  label: LocalizedField;
  url: string;
};

type SectionFormValues = {
  sectionName: string;
  image: File | string | null;
  title: LocalizedField;
  description: LocalizedField;
  type: SectionType;
  highlights: HighlightFormItem[];
  gallery: GalleryFormItem[];
  links: LinkFormItem[];
};

interface SectionFormProps {
  defaultData?: Section;
}

const SectionForm = ({ defaultData }: SectionFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const isSuper = useAppSelector((state) => state.auth.isSuper);

  const isEditing = !!defaultData;

  const { control, handleSubmit, register, formState: { errors } } =
    useForm<SectionFormValues>({
      defaultValues: {
        sectionName: defaultData?.sectionName || "",
        image: defaultData?.image ? getBackendUri(defaultData.image) : "",
        title: {
          ar: defaultData?.title?.ar || "",
          en: defaultData?.title?.en || "",
        },
        description: {
          ar: defaultData?.description?.ar || "",
          en: defaultData?.description?.en || "",
        },
        type: defaultData?.type ?? "DEFAULT",
        highlights: (defaultData?.highlights ?? []).map((h) => ({
          key: { ar: h.key?.ar || "", en: h.key?.en || "" },
          value: h.value,
          image: h.image ? getBackendUri(h.image) : null,
        })),
        gallery: (defaultData?.gallery ?? []).map((g) => ({
          image: getBackendUri(g),
        })),
        links: (defaultData?.links ?? []).map((l) => ({
          label: { ar: l.label?.ar || "", en: l.label?.en || "" },
          url: l.url,
        })),
      },
    });

  const sectionType = useWatch({ control, name: "type" });

  const { fields: highlightFields, append: appendHighlight, remove: removeHighlight } =
    useFieldArray({ control, name: "highlights" });

  const { fields: galleryFields, append: appendGallery, remove: removeGallery } =
    useFieldArray({ control, name: "gallery" });

  const { fields: linkFields, append: appendLink, remove: removeLink } =
    useFieldArray({ control, name: "links" });

  const mutation = useMutation({
    mutationFn: async (data: SectionFormValues) => {
      const formData = new FormData();

      if (data.image instanceof File) {
        const compressed = await handleCompression(data.image);
        if (compressed) formData.append("image", compressed);
      }

      if (!isEditing) {
        formData.append("sectionName", data.sectionName);
      }

      formData.append("type", data.type);

      LANGS.forEach((lang) => {
        if (data.title?.[lang]) formData.append(`title[${lang}]`, data.title[lang]!);
        if (data.description?.[lang]) formData.append(`description[${lang}]`, data.description[lang]!);
      });

      if (data.type === "HIGHLIGHTS") {
        (data.highlights ?? []).forEach((item, i) => {
          LANGS.forEach((lang) => {
            if (item.key?.[lang]) formData.append(`highlights[${i}][key][${lang}]`, item.key[lang]!);
          });
          formData.append(`highlights[${i}][value]`, item.value);
          if (item.image instanceof File) {
            formData.append(`highlightImages[${i}]`, item.image);
          }
        });
      }

      if (data.type === "LINKS") {
        (data.links ?? []).forEach((item, i) => {
          LANGS.forEach((lang) => {
            if (item.label?.[lang]) formData.append(`links[${i}][label][${lang}]`, item.label[lang]!);
          });
          formData.append(`links[${i}][url]`, item.url);
        });
      }

      if (data.type === "GALLERY") {
        (data.gallery ?? []).forEach((item) => {
          if (item.image instanceof File) {
            formData.append("galleryImages", item.image);
          } else if (typeof item.image === "string") {
            formData.append("gallery[]", item.image);
          }
        });
      }

      if (isEditing) {
        return updateSection({ id: defaultData._id, data: formData });
      }
      return createSection(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SECTIONS_QUERY_KEY] });
      router.back();
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const tabs = [
    { label: t("arabic"), lang: "ar" as const },
    { label: t("english"), lang: "en" as const },
  ];

  const tabHasError = (lang: string) =>
    !!(errors as any).title?.[lang] || !!(errors as any).description?.[lang];

  return (
    <Box component="form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Stack spacing={3}>
        {/* Section name */}
        {isEditing ? (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              {t("sectionName")}
            </Typography>
            <Typography variant="h6">{defaultData.sectionName}</Typography>
          </Box>
        ) : (
          <TextInputComponent
            name="sectionName"
            label={t("sectionName")}
            control={control}
            required
          />
        )}

        {/* Type selector */}
        {isSuper && <Box>
          <Typography variant="subtitle2" color="text.secondary" mb={1}>
            {t("sectionType")}
          </Typography>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select size="small" {...field} sx={{ minWidth: 200 }}>
                <MenuItem value="DEFAULT">{t("default")}</MenuItem>
                <MenuItem value="HIGHLIGHTS">{t("highlights")}</MenuItem>
                <MenuItem value="GALLERY">{t("gallery")}</MenuItem>
                <MenuItem value="LINKS">{t("links")}</MenuItem>
              </Select>
            )}
          />
        </Box>}

        {/* Main image (only for DEFAULT type) */}
        {["DEFAULT", "HIGHLIGHTS"].includes(sectionType) && (
          <ImageInput
            name="image"
            control={control as any}
            imagePath={defaultData?.image ? getBackendUri(defaultData.image) : ""}
          />
        )}

        {/* Language tabs — hidden for GALLERY and LINKS */}
        {!["GALLERY", "LINKS"].includes(sectionType) && (
          <>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
              {tabs.map((tab, i) => (
                <Tab
                  key={tab.lang}
                  label={tab.label}
                  iconPosition="end"
                  icon={
                    tabHasError(tab.lang) ? (
                      <Box
                        component="span"
                        sx={{
                          width: 8, height: 8, borderRadius: "50%",
                          bgcolor: "error.main", display: "inline-block", ml: 0.5,
                        }}
                      />
                    ) : undefined
                  }
                  value={i}
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
          </>
        )}

        {/* Highlights (only for HIGHLIGHTS type) */}
        {sectionType === "HIGHLIGHTS" && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                {t("highlights")}
              </Typography>
              <Button
                size="small"
                startIcon={<Add />}
                variant="outlined"
                onClick={() =>
                  appendHighlight({
                    key: { ar: "", en: "" },
                    value: "",
                    image: null,
                  })
                }
              >
                {t("add")}
              </Button>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {highlightFields.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                {t("noHighlights")}
              </Typography>
            ) : (
              <Stack spacing={3}>
                {highlightFields.map((field, index) => (
                  <Paper key={field.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                        #{index + 1}
                      </Typography>
                      <Tooltip title={t("delete")}>
                        <IconButton color="error" size="small" onClick={() => removeHighlight(index)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Stack spacing={2}>
                      {/* Image */}
                      <ImageInput
                        name={`highlights.${index}.image`}
                        control={control as any}
                        imagePath={
                          typeof field.image === "string" && field.image
                            ? field.image
                            : undefined
                        }
                      />

                      {/* Value (the number/stat) */}
                      <TextField
                        size="small"
                        label={t("value")}
                        placeholder="500+"
                        {...register(`highlights.${index}.value`)}
                      />

                      {/* Key label per language */}
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {t("label")} ({t("perLanguage")})
                      </Typography>
                      <Stack spacing={1.5}>
                        {LANGS.map((lang) => (
                          <TextField
                            key={lang}
                            size="small"
                            label={`${t("label")} (${lang.toUpperCase()})`}
                            {...register(`highlights.${index}.key.${lang}`)}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        )}

        {/* Links (only for LINKS type) */}
        {sectionType === "LINKS" && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                {t("links")}
              </Typography>
              <Button
                size="small"
                startIcon={<Add />}
                variant="outlined"
                onClick={() => appendLink({ label: { ar: "", en: "" }, url: "" })}
                disabled={linkFields.length >= 3}
              >
                {t("add")}
              </Button>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {linkFields.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                {t("noLinks")}
              </Typography>
            ) : (
              <Stack spacing={2}>
                {linkFields.map((field, index) => (
                  <Paper key={field.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                        #{index + 1}
                      </Typography>
                      <Tooltip title={t("delete")}>
                        <IconButton color="error" size="small" onClick={() => removeLink(index)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Stack spacing={1.5}>
                      <TextField
                        size="small"
                        label={`${t("label")} (AR)`}
                        {...register(`links.${index}.label.ar`)}
                      />
                      <TextField
                        size="small"
                        label={`${t("label")} (EN)`}
                        {...register(`links.${index}.label.en`)}
                      />
                      <TextField
                        size="small"
                        label={t("url")}
                        placeholder="https://..."
                        {...register(`links.${index}.url`)}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        )}

        {/* Gallery (only for GALLERY type) */}
        {sectionType === "GALLERY" && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                {t("gallery")}
              </Typography>
              <Button
                size="small"
                startIcon={<Add />}
                variant="outlined"
                onClick={() => appendGallery({ image: null })}
              >
                {t("add")}
              </Button>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {galleryFields.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                {t("noImages")}
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {galleryFields.map((field, index) => (
                  <Grid key={field.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, position: "relative" }}>
                      <Tooltip title={t("delete")}>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => removeGallery(index)}
                          sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <ImageInput
                        name={`gallery.${index}.image`}
                        control={control as any}
                        imagePath={
                          typeof field.image === "string" && field.image ? field.image : undefined
                        }
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        )}

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

export default SectionForm;
