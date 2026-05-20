"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createProduct, updateProduct } from "@/backend-api/products/mutations";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { Product } from "@/backend-api/products/types";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type ImageItem = { file: File | string | null };

type ProductFormValues = {
  name: LocalizedField;
  description: LocalizedField;
  shortDescription: LocalizedField;
  images: ImageItem[];
  price: string;
  sku: string;
  category: string;
  subCategory: string;
  slug: string;
  tags: string;
  isActive: boolean;
  order: number;
};

interface ProductFormProps {
  defaultData?: Product;
}

const LANGS = ["ar", "en"] as const;

const ProductForm = ({ defaultData }: ProductFormProps) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const lang = i18n.language;

  const isEditing = !!defaultData;

  const { data: categories = [] } = useCategoriesQuery();

  const { control, handleSubmit, register, watch, setValue, formState: { errors } } =
    useForm<ProductFormValues>({
      defaultValues: {
        name: { ar: defaultData?.name?.ar ?? "", en: defaultData?.name?.en ?? "" },
        description: { ar: defaultData?.description?.ar ?? "", en: defaultData?.description?.en ?? "" },
        shortDescription: { ar: defaultData?.shortDescription?.ar ?? "", en: defaultData?.shortDescription?.en ?? "" },
        images: (defaultData?.images ?? []).map((src) => ({ file: getBackendUri(src) })),
        price: defaultData?.price !== undefined ? String(defaultData.price) : "",
        sku: defaultData?.sku ?? "",
        category: defaultData?.category?._id ?? "",
        subCategory: defaultData?.subCategory?._id ?? "",
        slug: defaultData?.slug ?? "",
        tags: (defaultData?.tags ?? []).join(", "),
        isActive: defaultData?.isActive ?? true,
        order: defaultData?.order ?? 0,
      },
    });

  const selectedCategory = watch("category");
  const isActiveValue = watch("isActive");

  const { data: subCategories = [] } = useSubCategoriesQuery(selectedCategory || undefined);

  const { fields: imageFields, append: appendImage, remove: removeImage } =
    useFieldArray({ control, name: "images" });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const formData = new FormData();

      // Localized fields
      LANGS.forEach((l) => {
        if (data.name?.[l]) formData.append(`name[${l}]`, data.name[l]!);
        if (data.description?.[l]) formData.append(`description[${l}]`, data.description[l]!);
        if (data.shortDescription?.[l]) formData.append(`shortDescription[${l}]`, data.shortDescription[l]!);
      });

      // Images: existing string paths go in images[], new File objects go as productImages
      for (const item of data.images) {
        if (item.file instanceof File) {
          const compressed = await handleCompression(item.file);
          if (compressed) formData.append("productImages", compressed);
        } else if (typeof item.file === "string" && item.file) {
          // strip the base URL so we store the path only
          const path = item.file.startsWith("http")
            ? new URL(item.file).pathname
            : item.file;
          formData.append("images[]", path);
        }
      }

      if (data.price) formData.append("price", data.price);
      if (data.sku) formData.append("sku", data.sku);
      if (!isEditing) formData.append("category", data.category);
      if (data.subCategory) formData.append("subCategory", data.subCategory);
      if (data.slug) formData.append("slug", data.slug);
      if (data.tags) {
        data.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((tag) => formData.append("tags[]", tag));
      }
      formData.append("isActive", String(data.isActive));
      formData.append("order", String(data.order));

      if (isEditing) {
        return updateProduct({ id: defaultData._id, data: formData });
      }
      return createProduct(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
      router.back();
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const tabHasError = (l: string) =>
    ["name", "description", "shortDescription"].some((f) => !!(errors as any)[f]?.[l]);

  return (
    <Box component="form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Stack spacing={3}>

        {/* ── Images ── */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t("images")}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => appendImage({ file: null })}
            >
              {t("add")}
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          {imageFields.length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              {t("noImages")}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {imageFields.map((field, index) => (
                <Grid key={field.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, position: "relative" }}>
                    {index === 0 && (
                      <Typography
                        variant="caption"
                        sx={{ position: "absolute", top: 8, left: 8, zIndex: 1, bgcolor: "primary.main", color: "white", px: 1, borderRadius: 1 }}
                      >
                        {t("mainImage")}
                      </Typography>
                    )}
                    <Tooltip title={t("delete")}>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => removeImage(index)}
                        sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <ImageInput
                      name={`images.${index}.file`}
                      control={control as any}
                      imagePath={
                        typeof field.file === "string" && field.file ? field.file : undefined
                      }
                    />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* ── Category & SubCategory ── */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required disabled={isEditing}>
              <InputLabel>{t("category")}</InputLabel>
              <Controller
                name="category"
                control={control}
                rules={{ required: !isEditing }}
                render={({ field }) => (
                  <Select
                    {...field}
                    label={t("category")}
                    error={!!errors.category}
                    onChange={(e) => {
                      field.onChange(e);
                      setValue("subCategory", "");
                    }}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat._id} value={cat._id}>
                        {cat.name[lang] ?? cat.name.en ?? cat.name.ar}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth disabled={!selectedCategory}>
              <InputLabel>{t("subCategory")}</InputLabel>
              <Controller
                name="subCategory"
                control={control}
                render={({ field }) => (
                  <Select {...field} label={t("subCategory")}>
                    <MenuItem value="">{t("none")}</MenuItem>
                    {subCategories.map((sub) => (
                      <MenuItem key={sub._id} value={sub._id}>
                        {sub.name[lang] ?? sub.name.en ?? sub.name.ar}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
        </Grid>

        {/* ── Price, SKU, Order ── */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextInputComponent name="price" label={t("price")} control={control} type="number" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextInputComponent name="sku" label={t("sku")} control={control} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextInputComponent name="order" label={t("order")} control={control} type="number" />
          </Grid>
        </Grid>

        {/* ── Slug & Tags ── */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="slug" label={t("slug")} control={control} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="tags" label={t("tags")} control={control} helperText={t("tagsHint")} />
          </Grid>
        </Grid>

        {/* ── Active ── */}
        <FormControlLabel
          control={
            <Switch
              checked={isActiveValue}
              {...register("isActive")}
              onChange={(e) => setValue("isActive", e.target.checked)}
            />
          }
          label={t("active")}
        />

        {/* ── Localized content tabs ── */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
          <Tab
            label={t("arabic")}
            iconPosition="end"
            icon={
              tabHasError("ar") ? (
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "error.main", display: "inline-block", ml: 0.5 }} />
              ) : undefined
            }
          />
          <Tab
            label={t("english")}
            iconPosition="end"
            icon={
              tabHasError("en") ? (
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "error.main", display: "inline-block", ml: 0.5 }} />
              ) : undefined
            }
          />
        </Tabs>

        <Stack spacing={2} sx={{ display: activeTab === 0 ? "flex" : "none" }}>
          <TextInputComponent name="name.ar" label={t("name")} control={control} required />
          <TextInputComponent name="shortDescription.ar" label={t("shortDescription")} control={control} multiline rows={2} />
          <TextInputComponent name="description.ar" label={t("description")} control={control} multiline rows={5} />
        </Stack>

        <Stack spacing={2} sx={{ display: activeTab === 1 ? "flex" : "none" }}>
          <TextInputComponent name="name.en" label={t("name")} control={control} required />
          <TextInputComponent name="shortDescription.en" label={t("shortDescription")} control={control} multiline rows={2} />
          <TextInputComponent name="description.en" label={t("description")} control={control} multiline rows={5} />
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

export default ProductForm;
