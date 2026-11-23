import { Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MenuItem, TextField } from "@mui/material";
import { CONTENT_LANGUAGES } from "@/backend-api/settings/types";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

/** Which languages products and categories are typed in. */
const ContentLanguagesSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("contentLanguages")}>
      <Controller
        name="contentLanguages"
        control={control}
        render={({ field }) => (
          <TextField
            select
            size="small"
            label={t("contentLanguagesLabel")}
            value={field.value}
            onChange={field.onChange}
            helperText={t("contentLanguagesHint")}
            sx={{ maxWidth: 360 }}
            fullWidth
          >
            {CONTENT_LANGUAGES.map((mode) => (
              <MenuItem key={mode} value={mode}>
                {t(`contentLanguagesOptions.${mode}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </SettingsSection>
  );
};

export default ContentLanguagesSection;
