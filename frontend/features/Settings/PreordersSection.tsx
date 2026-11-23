import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import SettingsSection from "./SettingsSection";
import SwitchField from "./SwitchField";
import type { SettingsFormValues } from "./types";

/** Pre-orders — sell what another warehouse still holds. */
const PreordersSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("preorders")}>
      <SwitchField
        name="preorderEnabled"
        control={control}
        label={t("preorderEnabled")}
        hint={t("preorderEnabledHint")}
      />
    </SettingsSection>
  );
};

export default PreordersSection;
