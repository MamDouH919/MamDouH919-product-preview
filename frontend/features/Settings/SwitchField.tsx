import { Control, Controller } from "react-hook-form";
import { FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import type { SettingsFormValues } from "./types";

type Props = {
  name: "showPrices" | "preorderEnabled";
  control: Control<SettingsFormValues>;
  label: string;
  hint: string;
};

/** A switch with a bold label and a caption underneath. */
const SwitchField = ({ name, control, label, hint }: Props) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <FormControlLabel
        control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
        label={
          <Stack>
            <Typography variant="body2" fontWeight={600}>{label}</Typography>
            <Typography variant="caption" color="text.secondary">{hint}</Typography>
          </Stack>
        }
      />
    )}
  />
);

export default SwitchField;
