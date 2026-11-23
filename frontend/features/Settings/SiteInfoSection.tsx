import { useState } from "react";
import { Control, useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Box, Stack, Tab, Tabs } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { useStoreLocales } from "@/lib/storeLocalesContext";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

const SiteInfoSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  const { languages: LANGS, multilingual } = useStoreLocales();
  const { errors } = useFormState({ control });
  const [activeTab, setActiveTab] = useState(0);

  const tabHasError = (lang: string) =>
    !!(errors as any).siteTitle?.[lang] || !!(errors as any).siteDescription?.[lang];

  return (
    <SettingsSection title={t("siteInfo")}>
      {multilingual && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          {LANGS.map((lang) => (
            <Tab
              key={lang}
              label={t(lang)}
              iconPosition="end"
              icon={tabHasError(lang) ? (
                <Box
                  component="span"
                  sx={{
                    width: 8, height: 8, borderRadius: "50%",
                    bgcolor: "error.main", display: "inline-block", ml: 0.5,
                  }}
                />
              ) : undefined}
            />
          ))}
        </Tabs>
      )}

      {LANGS.map((lang, i) => (
        <Stack key={lang} spacing={2} sx={{ display: activeTab === i ? "flex" : "none" }}>
          <TextInputComponent name={`siteTitle.${lang}`} label={t("siteTitle")} control={control} />
          <TextInputComponent
            name={`siteDescription.${lang}`}
            label={t("siteDescription")}
            control={control}
            multiline
            rows={3}
          />
          <TextInputComponent
            name={`currency.${lang}`}
            label={t("currency")}
            control={control}
            placeholder={lang === "ar" ? "ر.س" : lang === "es" ? "SAR" : "SAR"}
          />
        </Stack>
      ))}
    </SettingsSection>
  );
};

export default SiteInfoSection;
