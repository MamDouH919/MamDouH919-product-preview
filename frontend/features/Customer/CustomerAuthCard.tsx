"use client";

import { Paper, Stack, Typography } from "@mui/material";

/** The shared frame for the storefront sign-in, register and reset screens. */
const CustomerAuthCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <Stack alignItems="center" justifyContent="center" py={{ xs: 4, md: 8 }} px={2}>
    <Paper
      variant="outlined"
      sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, width: "100%", maxWidth: 440 }}
    >
      <Stack spacing={1} mb={3}>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Stack>
      {children}
    </Paper>
  </Stack>
);

export default CustomerAuthCard;
