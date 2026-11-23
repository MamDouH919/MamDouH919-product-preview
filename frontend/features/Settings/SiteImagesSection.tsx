import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Grid, Typography } from "@mui/material";
import { ImageInput } from "@/components/MUI/ImageInput";
import { getBackendUri } from "@/utils/helperFunctions";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

type Props = {
  control: Control<SettingsFormValues>;
  logo?: string | null;
  favicon?: string | null;
};

const SiteImagesSection = ({ control, logo, favicon }: Props) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("siteImages")}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t("logo")}
          </Typography>
          <ImageInput
            name="logo"
            control={control as any}
            imagePath={logo ? getBackendUri(logo) ?? undefined : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t("favicon")}
          </Typography>
          <ImageInput
            name="favicon"
            control={control as any}
            imagePath={favicon ? getBackendUri(favicon) ?? undefined : undefined}
            accept={{ "image/*": [], "image/x-icon": [".ico"] }}
          />
        </Grid>
      </Grid>
    </SettingsSection>
  );
};

export default SiteImagesSection;
