import { Control, UseFormRegister, useFieldArray, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, IconButton, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import { SOCIAL_KEYS, isShareLink } from "@/lib/social";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

type Props = {
  control: Control<SettingsFormValues>;
  register: UseFormRegister<SettingsFormValues>;
};

const SocialMediaSection = ({ control, register }: Props) => {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: "socialMedia" });
  const values = useWatch({ control, name: "socialMedia" });

  return (
    <SettingsSection
      title={t("socialMedia")}
      action={
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => append({ key: "INSTAGRAM", value: "" })}
          variant="outlined"
        >
          {t("add")}
        </Button>
      }
    >
      {fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("noSocialMedia")}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {fields.map((field, index) => (
            <Stack key={field.id} direction="row" spacing={1.5} alignItems="center">
              <Select
                size="small"
                defaultValue={field.key}
                {...register(`socialMedia.${index}.key`)}
                sx={{ minWidth: 150 }}
              >
                {SOCIAL_KEYS.map((k) => (
                  <MenuItem key={k} value={k}>{k}</MenuItem>
                ))}
              </Select>
              <TextField
                size="small"
                fullWidth
                placeholder="https://..."
                {...register(`socialMedia.${index}.value`)}
                helperText={isShareLink(values?.[index]?.value) ? t("socialShareLinkWarning") : undefined}
                slotProps={{ formHelperText: { sx: { color: "warning.main" } } }}
              />
              <IconButton color="error" onClick={() => remove(index)} size="small">
                <Delete />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
    </SettingsSection>
  );
};

export default SocialMediaSection;
