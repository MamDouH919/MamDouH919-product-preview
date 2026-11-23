import { Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MenuItem, TextField } from "@mui/material";
import { SUPPORTED_COUNTRIES } from "@/backend-api/price-list/types";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

const DeliveryCountrySection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("deliveryCountry")}>
      <Controller
        name="country"
        control={control}
        render={({ field }) => (
          <TextField
            select
            size="small"
            label={t("country")}
            value={field.value}
            onChange={field.onChange}
            helperText={t("deliveryCountryHint")}
            sx={{ maxWidth: 360 }}
            fullWidth
          >
            {SUPPORTED_COUNTRIES.map((code) => (
              <MenuItem key={code} value={code}>
                {t(`countries.${code}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </SettingsSection>
  );
};

export default DeliveryCountrySection;
