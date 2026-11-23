import type { ReactNode } from "react";
import { Divider, Paper, Stack, Typography } from "@mui/material";

type Props = {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
};

/** The titled card every settings group sits in. */
const SettingsSection = ({ title, hint, action, children }: Props) => (
  <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={hint ? 0.5 : 2}>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      {action}
    </Stack>
    {hint && (
      <Typography variant="caption" color="text.secondary" component="p" mb={2}>
        {hint}
      </Typography>
    )}
    <Divider sx={{ mb: 2 }} />
    {children}
  </Paper>
);

export default SettingsSection;
