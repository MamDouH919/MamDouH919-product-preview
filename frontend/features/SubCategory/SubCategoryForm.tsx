"use client";

import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Stack,
  Switch,
} from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import LanguageTabs from "@/components/LanguageTabs";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createSubCategory, updateSubCategory } from "@/backend-api/sub-categories/mutations";
import { SUB_CATEGORIES_QUERY_KEY } from "@/backend-api/sub-categories/hooks";
import { SubCategory } from "@/backend-api/sub-categories/types";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type SubCategoryFormValues = {
  image: File | string | null;
  name: LocalizedField;
  description: LocalizedField;
  slug: string;
  category: string;
  isActive: boolean;
  order: number;
};

interface SubCategoryFormProps {
  defaultData?: SubCategory;
}

const SubCategoryForm = ({ defaultData }: SubCategoryFormProps) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const isEditing = !!defaultData;

  const { data: categories = [] } = useCategoriesQuery();

  const { control, handleSubmit, register, watch, setValue, formState: { errors } } =
    useForm<SubCategoryFormValues>({
      defaultValues: {
        image: defaultData?.image ? getBackendUri(defaultData.image) : "",
        name: { ar: defaultData?.name?.ar ?? "", en: defaultData?.name?.en ?? "" },
        description: { ar: defaultData?.description?.ar ?? "", en: defaultData?.description?.en ?? "" },
        slug: defaultData?.slug ?? "",
        category: defaultData?.category?._id ?? "",
        isActive: defaultData?.isActive ?? true,
        order: defaultData?.order ?? 0,
      },
    });

  const isActiveValue = watch("isActive");

  const mutation = useMutation({
    mutationFn: async (data: SubCategoryFormValues) => {
      const formData = new FormData();

      if (data.image instanceof File) {
        const compressed = await handleCompression(data.image);
        if (compressed) formData.append("image", compressed);
      }

      if (data.name.ar) formData.append("name[ar]", data.name.ar);
      if (data.name.en) formData.append("name[en]", data.name.en);
      if (data.description.ar) formData.append("description[ar]", data.description.ar);
      if (data.description.en) formData.append("description[en]", data.description.en);
      if (data.slug) formData.append("slug", data.slug);
      if (!isEditing) formData.append("category", data.category);
      formData.append("isActive", String(data.isActive));
      formData.append("order", String(data.order));

      if (isEditing) {
        return updateSubCategory({ id: defaultData._id, data: formData });
      }
      return createSubCategory(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SUB_CATEGORIES_QUERY_KEY] });
      router.back();
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const tabHasError = (lang: string) =>
    ["name", "description"].some((field) => !!(errors as any)[field]?.[lang]);

  return (
    <Box component="form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Stack spacing={3}>
        <ImageInput
          name="image"
          control={control as any}
          imagePath={defaultData?.image ? getBackendUri(defaultData.image) : ""}
        />

        {!isEditing && (
          <FormControl fullWidth required>
            <InputLabel>{t("category")}</InputLabel>
            <Controller
              name="category"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select {...field} label={t("category")} error={!!errors.category}>
                  {categories.map((cat) => (
                    <MenuItem key={cat._id} value={cat._id}>
                      {cat.name[lang] ?? cat.name.en ?? cat.name.ar}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>
        )}

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

        <LanguageTabs hasError={tabHasError}>
          {(lang) => (
            <>
              <TextInputComponent name={`name.${lang}`} label={t("name")} control={control} required />
              <TextInputComponent name={`description.${lang}`} label={t("description")} control={control} multiline rows={3} />
            </>
          )}
        </LanguageTabs>

        <TextInputComponent name="slug" label={t("slug")} control={control} />
        <TextInputComponent name="order" label={t("order")} control={control} type="number" />

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

export default SubCategoryForm;
