import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import SettingsSection from "./SettingsSection";
import SwitchField from "./SwitchField";
import type { SettingsFormValues } from "./types";

/** A store that takes no orders may sell on enquiry, without prices. */
const StorefrontSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("storefront")}>
      <SwitchField
        name="showPrices"
        control={control}
        label={t("showPrices")}
        hint={t("showPricesHint")}
      />
    </SettingsSection>
  );
};

export default StorefrontSection;
