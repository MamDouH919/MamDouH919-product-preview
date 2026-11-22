"use client";

import { ReactNode, useState } from "react";
import {
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Close from "@mui/icons-material/Close";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { useTranslation } from "react-i18next";
import { useMediaQuery, useTheme } from "@mui/material";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";

export type FilterChip = { key: string; label: string; onDelete: () => void };

// Filter fields sit in a responsive grid, so any fixed width a page gave them has to yield.
const fieldsSx = {
  "& .MuiTextField-root, & .MuiFormControl-root, & .MuiAutocomplete-root": {
    width: "100%",
    minWidth: "0 !important",
    maxWidth: "none !important",
  },
} as const;

/** A titled group inside the filter panel. */
export const FilterSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Stack spacing={1}>
    <Typography
      variant="caption"
      fontWeight={700}
      color="text.secondary"
      sx={{ letterSpacing: 0.4 }}
    >
      {title}
    </Typography>
    {children}
  </Stack>
);

/** A single-choice filter as an autocomplete: type to narrow, clear with the x. */
export const FilterSelect = <T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value?: T;
  onChange: (value: T | undefined) => void;
}) => (
  <Autocomplete
    size="small"
    options={options}
    value={options.find((o) => o.value === value) ?? null}
    onChange={(_, option) => onChange(option?.value)}
    isOptionEqualToValue={(a, b) => a.value === b.value}
    getOptionLabel={(o) => o.label}
    renderInput={(params) => <TextField {...params} label={label} />}
  />
);

/**
 * List page layout. On desktop the filters are a fixed panel at the start edge (left in LTR,
 * right in RTL) and the content fills the rest; on mobile the panel becomes a bottom sheet.
 *
 * @param search       the main search box, first thing in the panel
 * @param filters      the other filter fields; use <FilterSection> to group them
 * @param actions      page buttons shown above the content (prefer <PageActions> in the breadcrumb)
 * @param activeCount  number of applied filters
 * @param chips        applied filters as removable chips above the content
 * @param onClear      resets every filter
 */
const FilterLayout = ({
  search,
  filters,
  actions,
  activeCount = 0,
  chips,
  onClear,
  children,
}: {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  actions?: ReactNode;
  activeCount?: number;
  chips?: FilterChip[];
  onClear?: () => void;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);

  const hasPanel = !!filters;

  const searchBox = search && (
    <TextField
      size="small"
      fullWidth
      value={search.value}
      onChange={(e) => search.onChange(e.target.value)}
      placeholder={search.placeholder ?? t("search")}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: 2.5,
          height: 40,
          bgcolor: "background.paper",
        },
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: search.value ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                aria-label={t("clear")}
                onClick={() => search.onChange("")}
              >
                <Close fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );

  const fields = (
    <Stack spacing={2.5} sx={fieldsSx}>
      {filters}
    </Stack>
  );

  const chipBar = chips && chips.length > 0 && (
    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
      {chips.map((c) => (
        <Chip
          key={c.key}
          label={c.label}
          onDelete={c.onDelete}
          size="small"
          sx={{
            borderRadius: 2,
            fontWeight: 500,
            color: "primary.main",
            bgcolor: (th) => alpha(th.palette.primary.main, 0.1),
            "& .MuiChip-deleteIcon": { color: "primary.main", opacity: 0.7 },
          }}
        />
      ))}
    </Stack>
  );

  const content = (
    <Stack spacing={1.5} flex={1} minWidth={0} minHeight={0}>
      {(compact || actions) && (
        <Stack direction="row" alignItems="center" gap={1}>
          {compact && searchBox && <Box flex={1}>{searchBox}</Box>}
          {compact && hasPanel && (
            <Badge
              color="primary"
              badgeContent={activeCount}
              invisible={!activeCount}
            >
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<TuneRounded />}
                onClick={() => setOpen(true)}
                sx={{
                  borderRadius: 2.5,
                  height: 40,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                {t("filters")}
              </Button>
            </Badge>
          )}
          {!compact && <Box flex={1} />}
          {actions}
        </Stack>
      )}
      {chipBar}
      <Box flex={1} minHeight={0} display="flex" flexDirection="column">
        {children}
      </Box>
    </Stack>
  );

  if (compact) {
    return (
      <>
        {content}
        <Drawer
          anchor="bottom"
          open={open}
          onClose={() => setOpen(false)}
          slotProps={{
            paper: {
              sx: {
                maxHeight: "85vh",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              },
            },
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            px={2}
            py={1.5}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {t("filters")}
            </Typography>
            <IconButton onClick={() => setOpen(false)} aria-label={t("close")}>
              <Close />
            </IconButton>
          </Stack>
          <Box flex={1} overflow="auto" px={2} pb={2}>
            {fields}
          </Box>
          <Stack
            direction="row"
            gap={1}
            px={2}
            py={1.5}
            borderTop={1}
            borderColor="divider"
          >
            {onClear && (
              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                disabled={!activeCount}
                onClick={onClear}
              >
                {t("clear")}
              </Button>
            )}
            <Button
              fullWidth
              variant="contained"
              onClick={() => setOpen(false)}
            >
              {t("apply")}
            </Button>
          </Stack>
        </Drawer>
      </>
    );
  }

  return (
    <Stack
      direction="row"
      gap={2}
      flex={1}
      minHeight={0}
      minWidth={0}
      alignItems="stretch"
    >
      {(hasPanel || searchBox) && (
        <Paper
          variant="outlined"
          sx={{
            width: 280,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(16, 24, 40, 0.06)",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            px={2}
            pt={1.75}
            pb={1}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <TuneRounded fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>
                {t("filters")}
              </Typography>
              {activeCount > 0 && (
                <Chip
                  size="small"
                  color="primary"
                  label={activeCount}
                  sx={{ height: 20 }}
                />
              )}
            </Stack>
            {onClear && (
              <Button
                size="small"
                color="inherit"
                disabled={!activeCount}
                startIcon={<RestartAltRounded fontSize="small" />}
                onClick={onClear}
                sx={{ color: "text.secondary", minWidth: 0 }}
              >
                {t("clear")}
              </Button>
            )}
          </Stack>
          <Box flex={1} overflow="auto" px={2} pb={2} pt={1}>
            <Stack spacing={2.5}>
              {searchBox}
              {hasPanel && fields}
            </Stack>
          </Box>
        </Paper>
      )}
      {content}
    </Stack>
  );
};

export default FilterLayout;
