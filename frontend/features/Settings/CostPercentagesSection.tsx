import { Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormControlLabel, Stack, Switch } from "@mui/material";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

/** Shown beside every unit cost typed; display only. */
const CostPercentagesSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("costPercentages")} hint={t("costPercentagesHint")}>
      <Stack>
        {(["costPlus5Percent", "costPlus15Percent"] as const).map((name) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label={t("costPlusRate", { rate: name === "costPlus5Percent" ? 5 : 15 })}
              />
            )}
          />
        ))}
      </Stack>
    </SettingsSection>
  );
};

export default CostPercentagesSection;
