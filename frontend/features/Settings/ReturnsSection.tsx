import { Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TextField } from "@mui/material";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

const ReturnsSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("returns")}>
      <Controller
        name="returnWindowDays"
        control={control}
        rules={{ validate: (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 365) }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            type="number"
            size="small"
            label={t("returnWindowDays")}
            error={!!fieldState.error}
            helperText={t("returnWindowDaysHint")}
            slotProps={{ htmlInput: { min: 0, max: 365 } }}
            sx={{ maxWidth: 360 }}
            fullWidth
          />
        )}
      />
    </SettingsSection>
  );
};

export default ReturnsSection;
