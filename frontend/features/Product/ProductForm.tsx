"use client";

import { ReactNode, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  TextField as MuiTextField,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import LanguageTabs from "@/components/LanguageTabs";
import { SUPPORTED_LOCALES } from "@/lib/locales";
import { useContentLanguages, useSeedSingleLanguage } from "@/lib/useContentLanguages";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createProduct, updateProduct } from "@/backend-api/products/mutations";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";
import { Product } from "@/backend-api/products/types";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";
import { getBackendUrl } from "@/lib/getBackendUrl";
import { formatMinorMoney } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";
import { useStoreModules } from "@/Hooks/useStoreModules";
import { useWarehousesQuery } from "@/backend-api/inventory/hooks";
import SlugField from "@/components/MUI/SlugField";
import CostPercentages, { addCostPercentages } from "@/components/CostPercentages";
import { cleanSlug } from "@/lib/slug";

type ImageItem = { file: File | string | null };

// `_id` travels back to the server so it can tell an edited variant from a new
// one — that is what keeps a variant's stock attached to it across an edit.
type VariantItem = {
  _id?: string;
  label: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  gtin: string;
  color: string;
  size: string;
  stock: string;
  /** Opening units per warehouse id, when the store has several. */
  warehouseStocks: Record<string, string>;
  unitCost: string;
  /** Cost percentages switched on for the opening cost; added to it when sent. */
  costRates: number[];
};

type ProductFormValues = {
  name: LocalizedField;
  description: LocalizedField;
  shortDescription: LocalizedField;
  images: ImageItem[];
  price: string;
  compareAtPrice: string;
  sku: string;
  brand: string;
  gtin: string;
  category: string;
  subCategory: string;
  slug: string;
  tags: string;
  variants: VariantItem[];
  isActive: boolean;
  order: number;
  trackStock: boolean;
  stock: string;
  warehouseStocks: Record<string, string>;
  unitCost: string;
  costRates: number[];
  lowStockThreshold: string;
  allowBackorder: boolean;
};

interface ProductFormProps {
  defaultData?: Product;
}

// Texts are sent for every language that has one, the store's or not, so
// turning a language off on the platform and back on loses nothing.
const LANGS = SUPPORTED_LOCALES;

// Mirrors the backend DTO: EAN-8, UPC-12, EAN-13 or GTIN-14.
const GTIN_PATTERN = /^(\d{8}|\d{12,14})$/;

const numberText = (n?: number | null) => (n != null ? String(n) : "");

// Mirrors the backend DTO: lowercase English letters, digits, single hyphens.

type TabKey = "basic" | "images" | "pricing" | "variants" | "inventory" | "visibility";

const ProductForm = ({ defaultData }: ProductFormProps) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const isEditing = !!defaultData;
  // Without the inventory module there is no stock to count, so its fields go.
  const { has } = useStoreModules();
  const tracksInventory = has("inventory");
  // With more than one open warehouse the opening quantity is typed per warehouse.
  const { data: warehousesData } = useWarehousesQuery(tracksInventory);
  const openWarehouses = (warehousesData?.data ?? []).filter((w) => w.isActive);
  const splitByWarehouse = openWarehouses.length > 1;

  const { data: categories = [] } = useCategoriesQuery();

  const content = useContentLanguages();

  const { control, handleSubmit, watch, setValue, getValues, formState: { errors } } =
    useForm<ProductFormValues>({
      defaultValues: {
        name: { ar: defaultData?.name?.ar ?? "", en: defaultData?.name?.en ?? "" },
        description: { ar: defaultData?.description?.ar ?? "", en: defaultData?.description?.en ?? "" },
        shortDescription: { ar: defaultData?.shortDescription?.ar ?? "", en: defaultData?.shortDescription?.en ?? "" },
        images: (defaultData?.images ?? []).map((src) => ({ file: getBackendUri(src) })),
        variants: (defaultData?.variants ?? []).map((v) => ({
          _id: v._id,
          label: v.label,
          price: numberText(v.price),
          compareAtPrice: numberText(v.compareAtPrice),
          sku: v.sku ?? "",
          gtin: v.gtin ?? "",
          color: v.color ?? "",
          size: v.size ?? "",
          stock: String(v.stock ?? 0),
          warehouseStocks: {},
          unitCost: "",
          costRates: [],
        })),
        price: defaultData?.price !== undefined ? String(defaultData.price) : "",
        compareAtPrice: numberText(defaultData?.compareAtPrice),
        sku: defaultData?.sku ?? "",
        brand: defaultData?.brand ?? "",
        gtin: defaultData?.gtin ?? "",
        category: defaultData?.category?._id ?? "",
        subCategory: defaultData?.subCategory?._id ?? "",
        slug: defaultData?.slug ?? "",
        tags: (defaultData?.tags ?? []).join(", "),
        isActive: defaultData?.isActive ?? true,
        order: defaultData?.order ?? 0,
        trackStock: defaultData?.trackStock ?? true,
        stock: String(defaultData?.stock ?? 0),
        warehouseStocks: {},
        unitCost: "",
        costRates: [],
        lowStockThreshold: String(defaultData?.lowStockThreshold ?? 0),
        allowBackorder: defaultData?.allowBackorder ?? false,
      },
    });

  useSeedSingleLanguage(content.single, ["name", "description", "shortDescription"], getValues, setValue);

  const selectedCategory = watch("category");

  const { data: subCategories = [] } = useSubCategoriesQuery(selectedCategory || undefined);

  const { fields: imageFields, append: appendImage, remove: removeImage } =
    useFieldArray({ control, name: "images" });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } =
    useFieldArray({ control, name: "variants" });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const formData = new FormData();

      // Localized fields; typed in one language, they go under every language.
      const name = content.fill(data.name);
      const description = content.fill(data.description);
      const shortDescription = content.fill(data.shortDescription);
      LANGS.forEach((l) => {
        if (name[l]) formData.append(`name[${l}]`, name[l]!);
        if (description[l]) formData.append(`description[${l}]`, description[l]!);
        if (shortDescription[l]) formData.append(`shortDescription[${l}]`, shortDescription[l]!);
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
              // Empty means "the product's price" — sending 0 would sell it free.
              ...(v.price.trim() !== "" ? { price: Number(v.price) } : {}),
              ...(v.compareAtPrice.trim() !== "" ? { compareAtPrice: Number(v.compareAtPrice) } : {}),
              ...(v.sku ? { sku: v.sku } : {}),
              ...(v.gtin.trim() ? { gtin: v.gtin.trim() } : {}),
              ...(v.color.trim() ? { color: v.color.trim() } : {}),
              ...(v.size.trim() ? { size: v.size.trim() } : {}),
              // Only meaningful for a new variant. The server ignores it for an
              // existing one and keeps whatever the ledger says.
              ...(splitStock(v.warehouseStocks, openWarehouses)
                ? (() => {
                    const split = splitStock(v.warehouseStocks, openWarehouses)!;
                    return { stock: sumStock(split), openingStocks: split };
                  })()
                : { stock: Number(v.stock) || 0 }),
              // Cost of the opening units, booked with them. New variants only.
              ...(!v._id && data.trackStock && v.unitCost.trim() !== "" ? { unitCost: Number(addCostPercentages(v.unitCost, v.costRates ?? [])) } : {}),
            })),
          ),
        );
      }

      if (tracksInventory) {
        formData.append("trackStock", String(data.trackStock));
        formData.append("allowBackorder", String(data.allowBackorder));
        formData.append("lowStockThreshold", String(Number(data.lowStockThreshold) || 0));
        // Opening stock only exists at creation — afterwards stock moves through
        // the inventory ledger, never through this form.
        if (!isEditing && !data.variants?.length) {
          const split = splitStock(data.warehouseStocks, openWarehouses);
          formData.append("stock", String(split ? sumStock(split) : Number(data.stock) || 0));
          if (split) formData.append("openingStocks", JSON.stringify(split));
          if (data.trackStock && data.unitCost.trim() !== "") formData.append("unitCost", addCostPercentages(data.unitCost.trim(), data.costRates));
        }
      } else if (!isEditing) {
        // Untracked, so the storefront never shows it sold out; an edit leaves
        // whatever was set while the store had stock.
        formData.append("trackStock", "false");
      }

      if (data.price) formData.append("price", data.price);
      if (data.sku) formData.append("sku", data.sku);
      // On edit these go even when empty, so clearing a field clears it.
      if (data.compareAtPrice || isEditing) formData.append("compareAtPrice", data.compareAtPrice.trim());
      if (data.brand || isEditing) formData.append("brand", data.brand.trim());
      if (data.gtin || isEditing) formData.append("gtin", data.gtin.trim());
      if (!isEditing) formData.append("category", data.category);
      if (data.subCategory) formData.append("subCategory", data.subCategory);
      // On edit an empty slug is still sent, so the server regenerates it.
      if (data.slug || isEditing) formData.append("slug", cleanSlug(data.slug));
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

  const trackStock = watch("trackStock");
  const hasVariants = variantFields.length > 0;
  const variantColumn = tracksInventory ? 3 : 4;
  // A cost at or above the selling price is almost always the price typed in
  // the wrong box; warn, don't block.
  const productPrice = watch("price");
  const costHint = (cost: string, price: string, fallback?: string) => {
    const c = Number(cost);
    const p = Number(price.trim() !== "" ? price : productPrice);
    if (cost.trim() !== "" && p > 0 && c >= p) return t("costAtOrAbovePrice");
    return fallback;
  };

  const currency = useCurrency();
  const [tab, setTab] = useState<TabKey>("basic");
  // Cost can only be typed while creating (afterwards it comes from purchases
  // and the inventory ledger), and only when stock is counted.
  const canTypeCost = tracksInventory && trackStock && !isEditing;
  const priceNum = (v?: string) => (v && v.trim() !== "" ? Number(v) : null);
  const typedCost = (cost: string, rates: number[]) =>
    cost.trim() === "" ? null : Number(addCostPercentages(cost.trim(), rates ?? []));
  const lastCost = (minor?: number | null) => (minor != null ? minor / 100 : null);

  const tabErrors: Record<TabKey, boolean> = {
    basic: ["name", "description", "shortDescription", "category", "tags"].some((f) => !!(errors as any)[f]),
    images: !!errors.images,
    pricing: ["price", "compareAtPrice", "sku", "gtin", "brand", "unitCost"].some((f) => !!(errors as any)[f]),
    variants: !!errors.variants,
    inventory: ["stock", "lowStockThreshold"].some((f) => !!(errors as any)[f]),
    visibility: ["slug", "order"].some((f) => !!(errors as any)[f]),
  };
  const tabs: { key: TabKey; label: string }[] = [
    { key: "basic", label: t("productBasicInfo") },
    { key: "images", label: t("images") },
    { key: "pricing", label: t("productPricing") },
    { key: "variants", label: t("variants") },
    ...(tracksInventory ? [{ key: "inventory" as TabKey, label: t("inventory") }] : []),
    { key: "visibility", label: t("productVisibility") },
  ];
  // Saving with a mistake in a tab that is not open sends the user to it.
  const onInvalid = () => {
    const first = tabs.find((x) => tabErrors[x.key]);
    if (first) setTab(first.key);
  };

  return (
    <Box component="form" noValidate onSubmit={handleSubmit((data) => mutation.mutate(data), onInvalid)}>
      <Stack spacing={3} sx={{ maxWidth: 960, mx: "auto" }}>
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {tabs.map((x) => (
              <Tab
                key={x.key}
                value={x.key}
                label={x.label}
                iconPosition="end"
                icon={
                  tabErrors[x.key] ? (
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "error.main", display: "inline-block", ml: 0.5 }} />
                  ) : undefined
                }
              />
            ))}
          </Tabs>
        </Paper>

        {/* Every tab stays mounted (just hidden) so the whole form validates. */}

        {/* ── Basic info + classification ── */}
        <TabPanel active={tab === "basic"}>
          <Stack spacing={3}>
            <FormSection title={t("productBasicInfo")} hint={t("productBasicInfoHint")}>
              <LanguageTabs hasError={tabHasError} languages={content.languages}>
                {(l) => (
                <>
                  <TextInputComponent name={`name.${l}`} label={t("name")} control={control} required />
                  <TextInputComponent
                    name={`shortDescription.${l}`}
                    label={t("shortDescription")}
                    control={control}
                    multiline
                    rows={2}
                    helperText={t("shortDescriptionHint")}
                  />
                  <TextInputComponent
                    name={`description.${l}`}
                    label={t("description")}
                    control={control}
                    multiline
                    rows={5}
                    helperText={t("descriptionHint")}
                  />
                </>
                )}
              </LanguageTabs>
            </FormSection>

            <FormSection title={t("productClassification")} hint={t("productClassificationHint")}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth disabled={isEditing} size="small" error={!!errors.category}>
                    <InputLabel>{`${t("category")} *`}</InputLabel>
                    <Controller
                      name="category"
                      control={control}
                      rules={{ required: isEditing ? false : t("fieldIsRequired") }}
                      render={({ field }) => (
                        <Select
                          {...field}
                          variant="outlined"
                          label={`${t("category")} *`}
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
                    {errors.category ? (
                      <FormHelperText>{String(errors.category.message ?? t("fieldIsRequired"))}</FormHelperText>
                    ) : (
                      isEditing && <FormHelperText>{t("categoryLockedHint")}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth disabled={!selectedCategory} size="small">
                    <InputLabel>{t("subCategory")}</InputLabel>
                    <Controller
                      name="subCategory"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} variant="outlined" label={t("subCategory")}>
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

                <Grid size={12}>
                  <TextInputComponent name="tags" label={t("tags")} control={control} helperText={t("tagsHint")} />
                </Grid>
              </Grid>
            </FormSection>
          </Stack>
        </TabPanel>

        {/* ── Images ── */}
        <TabPanel active={tab === "images"}>
          <FormSection
                      title={t("images")}
            hint={t("productImagesHint")}
            action={
              <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => appendImage({ file: null })}>
                {t("addImage")}
              </Button>
            }
          >
            {imageFields.length === 0 ? (
              <EmptyHint text={t("noImages")} />
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
          </FormSection>
        </TabPanel>

        {/* ── Pricing, cost & margin ── */}
        <TabPanel active={tab === "pricing"}>
          <Stack spacing={3}>
            <FormSection title={t("productPricing")} hint={t("productPricingHint")}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextInputComponent name="price" label={t("price")} control={control} type="number" helperText={t("priceHint")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextInputComponent name="compareAtPrice" label={t("compareAtPrice")} control={control} type="number" helperText={t("compareAtPriceHint")} />
                </Grid>

                {/* Cost sits with the prices so the margin is read right here. */}
                {!hasVariants && canTypeCost && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextInputComponent
                      name="unitCost"
                      label={t("openingUnitCost")}
                      control={control}
                      type="number"
                      helperText={costHint(watch("unitCost") ?? "", "", t("openingUnitCostHint"))}
                    />
                    <CostPercentages cost={watch("unitCost") ?? ""} value={watch("costRates")} onChange={(rates) => setValue("costRates", rates)} />
                    <Box mt={1}>
                      <OpeningStockNotice
                        t={t}
                        currency={currency}
                        stock={Number(watch("stock")) || 0}
                        cost={typedCost(watch("unitCost") ?? "", watch("costRates") ?? [])}
                      />
                    </Box>
                  </Grid>
                )}

                <Grid size={12}>
                  {!hasVariants && (
                    <ProfitSummary
                      t={t}
                      currency={currency}
                      price={priceNum(productPrice)}
                      cost={isEditing ? lastCost(defaultData?.lastUnitCostMinor) : typedCost(watch("unitCost") ?? "", watch("costRates") ?? [])}
                      costLabel={isEditing ? t("lastUnitCost") : undefined}
                      needsCostHint={canTypeCost || isEditing ? t("marginNeedsCost") : t("marginNeedsStockTracking")}
                    />
                  )}
                  {hasVariants && <Alert severity="info">{t("marginPerVariantHint")}</Alert>}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextInputComponent name="sku" label={t("sku")} control={control} helperText={t("skuHint")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextInputComponent
                    name="gtin"
                    label={t("gtin")}
                    control={control}
                    helperText={t("gtinHint")}
                    rules={{ pattern: { value: GTIN_PATTERN, message: t("gtinInvalid") } }}
                  />
                </Grid>
                <Grid size={12}>
                  <TextInputComponent name="brand" label={t("brand")} control={control} helperText={t("brandHint")} />
                </Grid>
              </Grid>
            </FormSection>
          </Stack>
        </TabPanel>

        {/* ── Variants ── */}
        <TabPanel active={tab === "variants"}>
          <FormSection
                      title={t("variants")}
            hint={t("productVariantsHint")}
            action={
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={() =>
                  appendVariant({ label: "", price: "", compareAtPrice: "", sku: "", gtin: "", color: "", size: "", stock: "0", warehouseStocks: {}, unitCost: "", costRates: [] })
                }
              >
                {t("addVariant")}
              </Button>
            }
          >
            {!hasVariants ? (
              <EmptyHint text={t("noVariantsHint")} />
            ) : (
              <Stack spacing={2}>
                <Typography variant="caption" color="text.secondary">
                  {t("variantAttributesHint")}
                </Typography>
                {variantFields.map((field, index) => (
                  <Paper key={field.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Grid container spacing={2} sx={{ flex: 1 }}>
                        <Grid size={{ xs: 12, sm: 6, md: variantColumn }}>
                          <TextInputComponent
                            name={`variants.${index}.label`}
                            label={t("label")}
                            control={control}
                            required
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: variantColumn }}>
                          <TextInputComponent
                            name={`variants.${index}.price`}
                            label={t("price")}
                            control={control}
                            type="number"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: tracksInventory ? 6 : 12, md: variantColumn }}>
                          <TextInputComponent
                            name={`variants.${index}.sku`}
                            label={t("sku")}
                            control={control}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <TextInputComponent
                            name={`variants.${index}.compareAtPrice`}
                            label={t("compareAtPrice")}
                            control={control}
                            type="number"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <TextInputComponent name={`variants.${index}.color`} label={t("color")} control={control} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <TextInputComponent name={`variants.${index}.size`} label={t("size")} control={control} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <TextInputComponent
                            name={`variants.${index}.gtin`}
                            label={t("gtin")}
                            control={control}
                            rules={{ pattern: { value: GTIN_PATTERN, message: t("gtinInvalid") } }}
                          />
                        </Grid>
                        {tracksInventory && trackStock && splitByWarehouse && !field._id && (
                          <Grid size={12}>
                            <WarehouseQuantities
                              t={t}
                              lang={lang}
                              warehouses={openWarehouses}
                              values={watch(`variants.${index}.warehouseStocks`) ?? {}}
                              onChange={(next) => {
                                setValue(`variants.${index}.warehouseStocks`, next);
                                setValue(`variants.${index}.stock`, String(sumStock(splitStock(next, openWarehouses) ?? [])));
                              }}
                            />
                          </Grid>
                        )}
                        {tracksInventory && !(trackStock && splitByWarehouse && !field._id) && (
                          <Grid size={{ xs: 12, sm: 6, md: variantColumn }}>
                            <TextInputComponent
                              name={`variants.${index}.stock`}
                              label={field._id ? t("currentStock") : t("openingStock")}
                              control={control}
                              type="number"
                              readOnly={!!field._id}
                              helperText={field._id ? t("stockEditedInInventory") : undefined}
                            />
                          </Grid>
                        )}
                        {tracksInventory && trackStock && !field._id && (
                          <Grid size={{ xs: 12, sm: 6, md: variantColumn }}>
                            <TextInputComponent
                              name={`variants.${index}.unitCost`}
                              label={t("openingUnitCost")}
                              control={control}
                              type="number"
                              helperText={costHint(
                                watch(`variants.${index}.unitCost`) ?? "",
                                watch(`variants.${index}.price`) ?? "",
                              )}
                            />
                            <CostPercentages
                              cost={watch(`variants.${index}.unitCost`) ?? ""}
                              value={watch(`variants.${index}.costRates`) ?? []}
                              onChange={(rates) => setValue(`variants.${index}.costRates`, rates)}
                            />
                            <Box mt={1}>
                              <OpeningStockNotice
                                t={t}
                                currency={currency}
                                stock={Number(watch(`variants.${index}.stock`)) || 0}
                                cost={typedCost(watch(`variants.${index}.unitCost`) ?? "", watch(`variants.${index}.costRates`) ?? [])}
                              />
                            </Box>
                          </Grid>
                        )}
                        <Grid size={12}>
                          <ProfitSummary
                            t={t}
                            currency={currency}
                            compact
                            price={priceNum(watch(`variants.${index}.price`)) ?? priceNum(productPrice)}
                            cost={
                              field._id
                                ? lastCost(defaultData?.variants?.find((v) => v._id === field._id)?.lastUnitCostMinor)
                                : typedCost(watch(`variants.${index}.unitCost`) ?? "", watch(`variants.${index}.costRates`) ?? [])
                            }
                            costLabel={field._id ? t("lastUnitCost") : undefined}
                            needsCostHint={t("marginNeedsCost")}
                          />
                        </Grid>
                      </Grid>
                      <Tooltip title={t("delete")}>
                        <IconButton color="error" onClick={() => removeVariant(index)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </FormSection>
        </TabPanel>

        {/* ── Inventory ── */}
        {tracksInventory && (
          <TabPanel active={tab === "inventory"}>
            <FormSection title={t("inventory")} hint={t("productInventoryHint")}>
            <Stack spacing={2}>
              <SwitchField
                checked={trackStock}
                onChange={(v) => setValue("trackStock", v)}
                label={t("trackStock")}
                hint={t("trackStockHint")}
              />

              {trackStock && (
                <>
                  <Grid container spacing={2}>
                    {/* With variants, stock lives per variant — there is nothing
                        meaningful to type here. */}
                    {!hasVariants && splitByWarehouse && !isEditing && (
                      <Grid size={12}>
                        <WarehouseQuantities
                          t={t}
                          lang={lang}
                          warehouses={openWarehouses}
                          values={watch("warehouseStocks") ?? {}}
                          onChange={(next) => {
                            setValue("warehouseStocks", next);
                            setValue("stock", String(sumStock(splitStock(next, openWarehouses) ?? [])));
                          }}
                        />
                      </Grid>
                    )}
                    {!hasVariants && !(splitByWarehouse && !isEditing) && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextInputComponent
                          name="stock"
                          label={isEditing ? t("currentStock") : t("openingStock")}
                          control={control}
                          type="number"
                          readOnly={isEditing}
                          helperText={isEditing ? t("stockEditedInInventory") : t("openingStockHint")}
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextInputComponent
                        name="lowStockThreshold"
                        label={t("lowStockThreshold")}
                        control={control}
                        type="number"
                        helperText={t("lowStockThresholdHint")}
                      />
                    </Grid>
                  </Grid>

                  {hasVariants && <Alert severity="info">{t("stockPerVariantHint")}</Alert>}

                  {!hasVariants && !isEditing && (
                    <OpeningStockNotice
                      t={t}
                      currency={currency}
                      stock={Number(watch("stock")) || 0}
                      cost={typedCost(watch("unitCost") ?? "", watch("costRates") ?? [])}
                    />
                  )}

                  <SwitchField
                    checked={watch("allowBackorder")}
                    onChange={(v) => setValue("allowBackorder", v)}
                    label={t("allowBackorder")}
                    hint={t("allowBackorderHint")}
                  />
                </>
              )}
            </Stack>
          </FormSection>
          </TabPanel>
        )}

        {/* ── Visibility, order & slug ── */}
        <TabPanel active={tab === "visibility"}>
          <FormSection title={t("productVisibility")} hint={t("productVisibilityHint")}>
            <Stack spacing={2}>
              <SwitchField
                checked={watch("isActive")}
                onChange={(v) => setValue("isActive", v)}
                label={t("active")}
                hint={t("activeHint")}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <SlugField name="slug" control={control} hint={t("slugHint")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextInputComponent
                    name="order"
                    label={t("order")}
                    control={control}
                    type="number"
                    helperText={t("orderHint")}
                  />
                </Grid>
              </Grid>
            </Stack>
          </FormSection>
        </TabPanel>

        {/* ── Actions ── */}
        <Paper
          elevation={3}
          sx={{ position: "sticky", bottom: 16, zIndex: 2, p: 2, borderRadius: 2 }}
        >
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="text" onClick={() => router.back()} disabled={mutation.isPending}>
              {t("cancel")}
            </Button>
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
        </Paper>
      </Stack>
    </Box>
  );
};

interface FormSectionProps {
  title: string;
  hint: string;
  action?: ReactNode;
  children: ReactNode;
}

// A card with a title and a sentence on what the section is for.
const FormSection = ({ title, hint, action, children }: FormSectionProps) => (
  <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
    <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={2}>
      <Box flex={1}>
        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.75}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      {action && <Box flexShrink={0}>{action}</Box>}
    </Stack>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Paper>
);

interface SwitchFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}

const SwitchField = ({ checked, onChange, label, hint }: SwitchFieldProps) => (
  <FormControlLabel
    sx={{ alignItems: "flex-start", mx: 0, gap: 1 }}
    control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />}
    label={
      <Box pt={1}>
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </Box>
    }
  />
);

const TabPanel = ({ active, children }: { active: boolean; children: ReactNode }) => (
  <Box role="tabpanel" sx={{ display: active ? "block" : "none" }}>
    {children}
  </Box>
);

interface ProfitSummaryProps {
  t: (k: string) => string;
  currency: string;
  price: number | null;
  cost: number | null;
  costLabel?: string;
  needsCostHint: string;
  compact?: boolean;
}

// Profit and margin for one unit: price - cost, as a share of the price
// (margin) and of the cost (markup). Shown live as the numbers are typed.
const ProfitSummary = ({ t, currency, price, cost, costLabel, needsCostHint, compact }: ProfitSummaryProps) => {
  if (price == null || !(price > 0) || cost == null) {
    return (
      <Typography variant="caption" color="text.secondary">
        {price == null || !(price > 0) ? t("marginNeedsPrice") : needsCostHint}
      </Typography>
    );
  }
  const profit = price - cost;
  const margin = (profit / price) * 100;
  const markup = cost > 0 ? (profit / cost) * 100 : null;
  const color = profit < 0 ? "error.main" : "success.main";
  const money = (n: number) => formatMinorMoney(Math.round(n * 100), currency);
  const item = (label: string, value: string, c?: string) => (
    <Box sx={{ minWidth: 110 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant={compact ? "body2" : "subtitle1"} fontWeight={700} color={c}>{value}</Typography>
    </Box>
  );
  return (
    <Paper variant="outlined" sx={{ p: compact ? 1 : 2, borderRadius: 2, bgcolor: "action.hover" }}>
      <Stack direction="row" flexWrap="wrap" gap={compact ? 2 : 4}>
        {item(costLabel ?? t("cost"), money(cost))}
        {item(t("profitPerUnit"), money(profit), color)}
        {item(t("profitMargin"), `${margin.toFixed(1)}%`, color)}
        {markup != null && item(t("markup"), `${markup.toFixed(1)}%`)}
      </Stack>
    </Paper>
  );
};

type OpeningSplit = { warehouseId: string; quantity: number }[];

/** Quantities typed per warehouse as the list the server takes; undefined when nothing is typed there. */
function splitStock(values: Record<string, string> | undefined, warehouses: { _id: string }[]): OpeningSplit | undefined {
  if (!values || warehouses.length < 2) return undefined;
  const split = warehouses.map((w) => ({ warehouseId: w._id, quantity: Math.max(Number(values[w._id]) || 0, 0) }));
  return split.some((s) => s.quantity > 0) ? split.filter((s) => s.quantity > 0) : undefined;
}

const sumStock = (split: OpeningSplit) => split.reduce((sum, s) => sum + s.quantity, 0);

interface WarehouseQuantitiesProps {
  t: (key: string, options?: Record<string, unknown>) => string;
  lang: string;
  warehouses: { _id: string; name: LocalizedField; code: string; isMain: boolean }[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/** One quantity box per open warehouse, with the total they add up to. */
const WarehouseQuantities = ({ t, lang, warehouses, values, onChange }: WarehouseQuantitiesProps) => {
  const total = warehouses.reduce((sum, w) => sum + Math.max(Number(values[w._id]) || 0, 0), 0);
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{t("openingStockPerWarehouse")}</Typography>
      <Grid container spacing={2}>
        {warehouses.map((w) => (
          <Grid key={w._id} size={{ xs: 12, sm: 6 }}>
            <MuiTextField
              fullWidth
              size="small"
              type="number"
              label={`${(w.name as Record<string, string>)[lang] || w.name.ar || w.name.en || w.code}${w.isMain ? ` (${t("mainWarehouse")})` : ""}`}
              value={values[w._id] ?? ""}
              onChange={(e) => onChange({ ...values, [w._id]: e.target.value })}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Grid>
        ))}
      </Grid>
      <Typography variant="caption" color="text.secondary">
        {t("openingStockTotal", { total })}
      </Typography>
    </Stack>
  );
};

interface OpeningStockNoticeProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  currency: ReturnType<typeof useCurrency>;
  /** Quantity typed as opening stock. */
  stock: number;
  /** Cost per unit after percentages, or null when none was typed. */
  cost: number | null;
}

/**
 * Tells the admin what an opening quantity does to the books before they save:
 * with a cost it is booked as inventory against owner equity; without one the
 * units sit uncosted and their first sale reports the whole price as profit.
 */
const OpeningStockNotice = ({ t, currency, stock, cost }: OpeningStockNoticeProps) => {
  const hasStock = stock > 0;
  const hasCost = cost != null && cost > 0;
  if (!hasStock && !hasCost) return null;
  const money = (n: number) => formatMinorMoney(Math.round(n * 100), currency);

  if (!hasStock) return <Alert severity="warning">{t("costWithoutStock")}</Alert>;
  if (!hasCost) return <Alert severity="warning">{t("stockWithoutCost")}</Alert>;
  return (
    <Alert severity="info">
      {t("openingStockBooked", { qty: stock, cost: money(cost), total: money(stock * cost) })}
    </Alert>
  );
};

const EmptyHint = ({ text }: { text: string }) => (
  <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
    {text}
  </Typography>
);

export default ProductForm;
