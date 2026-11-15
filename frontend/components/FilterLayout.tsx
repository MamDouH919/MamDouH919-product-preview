"use client";

import { ReactNode, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Close, FilterListOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// Filter fields are laid out one per row, so any width the page set for the old
// horizontal bar (`minWidth: 260`) has to give way to the column.
const fieldsSx = {
  "& .MuiTextField-root, & .MuiFormControl-root, & .MuiAutocomplete-root": {
    width: "100%",
    minWidth: "0 !important",
    maxWidth: "none !important",
  },
} as const;

/**
 * List page layout: content takes 10 of 12 columns, filters take 2 beside it.
 * At `md` and below the filters move into a bottom drawer (75% of the screen)
 * opened from a button above the content.
 *
 * @param filters      the filter fields (stacked vertically)
 * @param actions      page-level buttons (export, "new" …) that stay above the content
 * @param activeCount  how many filters are applied, shown as a badge on the mobile button
 */
const FilterLayout = ({
  filters,
  actions,
  activeCount = 0,
  children,
}: {
  filters: ReactNode;
  actions?: ReactNode;
  activeCount?: number;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("lg"));
  const [open, setOpen] = useState(false);

  const fields = (
    <Stack spacing={2} sx={fieldsSx}>
      {filters}
    </Stack>
  );

  const content = (
    <Stack spacing={2} flex={1} minHeight={0} minWidth={0}>
      {(compact || actions) && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          {compact ? (
            <Badge color="primary" badgeContent={activeCount} invisible={!activeCount}>
              <Button variant="outlined" startIcon={<FilterListOutlined />} onClick={() => setOpen(true)}>
                {t("filters")}
              </Button>
            </Badge>
          ) : (
            <Box />
          )}
          {actions && (
            <Stack direction="row" spacing={1} alignItems="center">
              {actions}
            </Stack>
          )}
        </Stack>
      )}
      <Box flex={1} minHeight={0} display="flex" flexDirection="column">
        {children}
      </Box>
    </Stack>
  );

  return (
    <Grid container spacing={2} sx={{ flex: 1, height: "100%", minHeight: 0, flexWrap: "nowrap", overflow: "hidden" }}>
      <Grid size={{ xs: 12, lg: 10 }} sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {content}
      </Grid>

      {compact ? (
        <Drawer
          anchor="bottom"
          open={open}
          onClose={() => setOpen(false)}
          slotProps={{
            paper: {
              sx: {
                height: "75vh",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              },
            },
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t("filters")}
            </Typography>
            <IconButton onClick={() => setOpen(false)} aria-label={t("close")}>
              <Close />
            </IconButton>
          </Stack>
          <Box flex={1} overflow="auto" px={2} pb={2} pt={1}>
            {fields}
          </Box>
          <Box px={2} py={1.5} borderTop={1} borderColor="divider">
            <Button fullWidth variant="contained" onClick={() => setOpen(false)}>
              {t("apply")}
            </Button>
          </Box>
        </Drawer>
      ) : (
        <Grid size={{ lg: 2 }} sx={{ minWidth: 0, minHeight: 0, overflowY: "auto" }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
              {t("filters")}
            </Typography>
            {fields}
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default FilterLayout;
