import { Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { updateColor } from "@/Store/slices/settings";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

const DEFAULT_COLOR = "#1976d2";

const AppearanceSection = ({ control }: { control: Control<SettingsFormValues> }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <SettingsSection title={t("appearance")}>
      <Controller
        name="primaryColor"
        control={control}
        render={({ field }) => {
          const value = field.value ?? DEFAULT_COLOR;
          const change = (color: string) => {
            field.onChange(color);
            dispatch(updateColor(color));
          };
          return (
            <Stack spacing={1.5}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                {t("primaryColor")}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 44, height: 44, borderRadius: 1.5,
                    border: "2px solid", borderColor: "divider",
                    overflow: "hidden", cursor: "pointer", flexShrink: 0,
                    "& input[type='color']": {
                      width: "200%", height: "200%",
                      border: "none", padding: 0, cursor: "pointer",
                      transform: "translate(-25%, -25%)",
                    },
                  }}
                >
                  <input type="color" value={value} onChange={(e) => change(e.target.value)} />
                </Box>
                <TextField
                  size="small"
                  value={value}
                  onChange={(e) => change(e.target.value)}
                  sx={{ width: 140 }}
                  placeholder={DEFAULT_COLOR}
                />
                <Box
                  sx={{
                    flex: 1, height: 44, borderRadius: 1.5,
                    background: value,
                    border: "1px solid", borderColor: "divider",
                  }}
                />
              </Stack>
            </Stack>
          );
        }}
      />
    </SettingsSection>
  );
};

export default AppearanceSection;
