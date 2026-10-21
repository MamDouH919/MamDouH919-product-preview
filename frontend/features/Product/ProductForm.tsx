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
import { getBackendUrl } from "@/lib/getBackendUrl";

type ImageItem = { file: File | string | null };

// `_id` travels back to the server so it can tell an edited variant from a new
// one — that is what keeps a variant's stock attached to it across an edit.
type VariantItem = { _id?: string; label: string; price: string; sku: string; stock: string };

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
  variants: VariantItem[];
  isActive: boolean;
  order: number;
  trackStock: boolean;
  stock: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
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
        variants: (defaultData?.variants ?? []).map((v) => ({
          _id: v._id,
          label: v.label,
          price: v.price !== undefined ? String(v.price) : "",
          sku: v.sku ?? "",
          stock: String(v.stock ?? 0),
        })),
        price: defaultData?.price !== undefined ? String(defaultData.price) : "",
        sku: defaultData?.sku ?? "",
        category: defaultData?.category?._id ?? "",
        subCategory: defaultData?.subCategory?._id ?? "",
        slug: defaultData?.slug ?? "",
        tags: (defaultData?.tags ?? []).join(", "),
        isActive: defaultData?.isActive ?? true,
        order: defaultData?.order ?? 0,
        trackStock: defaultData?.trackStock ?? true,
        stock: String(defaultData?.stock ?? 0),
        lowStockThreshold: String(defaultData?.lowStockThreshold ?? 0),
        allowBackorder: defaultData?.allowBackorder ?? false,
      },
    });

  const selectedCategory = watch("category");
  const isActiveValue = watch("isActive");

  const { data: subCategories = [] } = useSubCategoriesQuery(selectedCategory || undefined);

  const { fields: imageFields, append: appendImage, remove: removeImage } =
    useFieldArray({ control, name: "images" });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } =
    useFieldArray({ control, name: "variants" });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const formData = new FormData();

      // Localized fields
      LANGS.forEach((l) => {
        if (data.name?.[l]) formData.append(`name[${l}]`, data.name[l]!);
        if (data.description?.[l]) formData.append(`description[${l}]`, data.description[l]!);
        if (data.shortDescription?.[l]) formData.append(`shortDescription[${l}]`, data.shortDescription[l]!);
      });

      // Images: existing paths are sent as one JSON list (so an empty list can
      // mean "remove them all"), new File objects go as productImages
      const keptPaths: string[] = [];
      for (const item of data.images) {
        if (item.file instanceof File) {
          const compressed = await handleCompression(item.file);
          if (compressed) formData.append("productImages", compressed);
        } else if (typeof item.file === "string" && item.file) {
          // strip the backend URL so a local image keeps its stored path; an R2 URL is stored whole
          const backend = getBackendUrl();
          keptPaths.push(backend && item.file.startsWith(backend + "/") ? item.file.slice(backend.length) : item.file);
        }
      }
      formData.append("images", JSON.stringify(keptPaths));

      if (data.variants?.length) {
        formData.append(
          "variants",
          JSON.stringify(
            data.variants.map((v) => ({
              ...(v._id ? { _id: v._id } : {}),
              label: v.label,
              price: Number(v.price) || 0,
              ...(v.sku ? { sku: v.sku } : {}),
              // Only meaningful for a new variant. The server ignores it for an
              // existing one and keeps whatever the ledger says.
              stock: Number(v.stock) || 0,
            })),
          ),
        );
      }

      formData.append("trackStock", String(data.trackStock));
      formData.append("allowBackorder", String(data.allowBackorder));
      formData.append("lowStockThreshold", String(Number(data.lowStockThreshold) || 0));
      // Opening stock only exists at creation — afterwards stock moves through
      // the inventory ledger, never through this form.
      if (!isEditing && !data.variants?.length) {
        formData.append("stock", String(Number(data.stock) || 0));
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
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error((Array.isArray(message) ? message.join(", ") : message) ?? t("somethingWentWrong"));
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

        {/* ── Variants ── */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t("variants")}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => appendVariant({ label: "", price: "", sku: "", stock: "0" })}
            >
              {t("add")}
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          {variantFields.length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              {t("noData")}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {variantFields.map((field, index) => (
                <Stack key={field.id} direction="row" spacing={2} alignItems="flex-start">
                  <TextInputComponent
                    name={`variants.${index}.label`}
                    label={t("label")}
                    control={control}
                    required
                  />
                  <TextInputComponent
                    name={`variants.${index}.price`}
                    label={t("price")}
                    control={control}
                    type="number"
                  />
                  <TextInputComponent
                    name={`variants.${index}.sku`}
                    label={t("sku")}
                    control={control}
                  />
                  <TextInputComponent
                    name={`variants.${index}.stock`}
                    label={variantFields[index]?._id ? t("currentStock") : t("openingStock")}
                    control={control}
                    type="number"
                    readOnly={!!variantFields[index]?._id}
                    helperText={
                      variantFields[index]?._id ? t("stockEditedInInventory") : undefined
                    }
                  />
                  <Tooltip title={t("delete")}>
                    <IconButton color="error" onClick={() => removeVariant(index)} sx={{ mt: 0.5 }}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>

        {/* ── Inventory ── */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            {t("inventory")}
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={watch("trackStock")}
                  onChange={(e) => setValue("trackStock", e.target.checked)}
                />
              }
              label={t("trackStock")}
            />

            {watch("trackStock") && (
              <Grid container spacing={2}>
                {/* With variants, stock lives per variant — there is nothing
                    meaningful to type here. */}
                {!isEditing && variantFields.length === 0 && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextInputComponent
                      name="stock"
                      label={t("openingStock")}
                      control={control}
                      type="number"
                    />
                  </Grid>
                )}
                {isEditing && variantFields.length === 0 && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextInputComponent
                      name="stock"
                      label={t("currentStock")}
                      control={control}
                      type="number"
                      readOnly
                      helperText={t("stockEditedInInventory")}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextInputComponent
                    name="lowStockThreshold"
                    label={t("lowStockThreshold")}
                    control={control}
                    type="number"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={watch("allowBackorder")}
                        onChange={(e) => setValue("allowBackorder", e.target.checked)}
                      />
                    }
                    label={t("allowBackorder")}
                  />
                </Grid>
              </Grid>
            )}
          </Stack>
        </Paper>

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
