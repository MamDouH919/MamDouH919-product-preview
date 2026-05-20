"use client";

import { useFieldArray, useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import { createPartner, updatePartner } from "@/backend-api/partners/mutations";
import { PARTNERS_QUERY_KEY } from "@/backend-api/partners/hooks";
import { Partner } from "@/backend-api/partners/types";
import { getBackendUri } from "@/utils/helperFunctions";
import { SOCIAL_MEDIA_OPTIONS } from "@/lib/socialMediaOptions";

type PartnerFormValues = {
  name: string;
  image: File | string | null;
  active: boolean;
  socialMedia: { key: string; value: string }[];
};

interface PartnerFormProps {
  defaultData?: Partner;
}

const PartnerForm = ({ defaultData }: PartnerFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!defaultData;

  const { control, handleSubmit, formState: { errors } } = useForm<PartnerFormValues>({
    defaultValues: {
      name: defaultData?.name || "",
      image: defaultData?.image ? getBackendUri(defaultData.image) : null,
      active: defaultData?.active ?? true,
      socialMedia: defaultData?.socialMedia || [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "socialMedia" });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEditing
        ? updatePartner({ id: defaultData!._id, data })
        : createPartner(data),
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [PARTNERS_QUERY_KEY] });
      router.back();
    },
    onError: () => toast.error(t("somethingWentWrong")),
  });

  const onSubmit = (values: PartnerFormValues) => {
    const fd = new FormData();
    fd.append("name", values.name);
    fd.append("active", String(values.active));

    if (values.image instanceof File) {
      fd.append("image", values.image);
    }

    values.socialMedia.forEach((item, i) => {
      fd.append(`socialMedia[${i}][key]`, item.key);
      fd.append(`socialMedia[${i}][value]`, item.value);
    });

    mutation.mutate(fd);
  };

  return (
    <Stack spacing={3} maxWidth={600}>
      <TextInputComponent
        name="name"
        control={control}
        label={t("name")}
        rules={{ required: t("name") + " is required" }}
        error={!!errors.name}
        helperText={errors.name?.message}
      />

      <ImageInput name="image" control={control as any} />

      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Typography variant="subtitle2" fontWeight={600}>{t("socialMedia")}</Typography>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => append({ key: "website", value: "" })}
          >
            {t("addSocialMedia")}
          </Button>
        </Stack>

        <Stack spacing={2}>
          {fields.map((field, index) => (
            <Stack key={field.id} direction="row" spacing={1} alignItems="center">
              <Controller
                name={`socialMedia.${index}.key`}
                control={control}
                rules={{ required: true }}
                render={({ field: selectField }) => (
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t("platform")}</InputLabel>
                    <Select {...selectField} label={t("platform")}>
                      {SOCIAL_MEDIA_OPTIONS.map((opt) => (
                        <MenuItem key={opt.key} value={opt.key}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <opt.Icon sx={{ fontSize: 18, color: opt.color }} />
                            <span>{opt.label}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <TextInputComponent
                name={`socialMedia.${index}.value`}
                control={control}
                label={t("link")}
                rules={{ required: true }}
              />

              <IconButton color="error" onClick={() => remove(index)}>
                <Delete />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Button
        variant="contained"
        onClick={handleSubmit(onSubmit)}
        disabled={mutation.isPending}
        startIcon={mutation.isPending ? <CircularProgress size={16} /> : null}
      >
        {t("saveSuccessfully")}
      </Button>
    </Stack>
  );
};

export default PartnerForm;
