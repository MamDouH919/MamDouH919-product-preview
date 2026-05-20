"use client";

import React, { useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import {
  Box,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  Paper,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { Controller, Control } from "react-hook-form";

/* ---------------- SAFE ICON EXTRACTION ---------------- */

const rawIcons = LucideIcons || {};

export const iconsMap = rawIcons as unknown as Record<string, React.ElementType>;

export const iconNames: string[] = Object.keys(rawIcons).filter((key) => {
  if (!/^[A-Z]/.test(key)) return false;
  const val = (rawIcons as any)[key];
  return (
    typeof val === "function" ||
    (val && typeof val === "object" && "$$typeof" in val)
  );
});

const PAGE_SIZE = 48;

/* ---------------- TYPES ---------------- */

interface IconPickerProps {
  name: string;
  control: Control<any>;
  label?: string;
}

/* ---------------- COMPONENT ---------------- */

const IconPicker = ({ name, control, label }: IconPickerProps) => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [prevSearch, setPrevSearch] = useState("");

  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(0);
  }

  const filteredIcons = useMemo(
    () => iconNames.filter((icon) => icon.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const totalPages = Math.ceil(filteredIcons.length / PAGE_SIZE);
  const pageIcons = filteredIcons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Controller
      name={name}
      control={control}
      defaultValue=""
      render={({ field }) => {
        const SelectedIcon = field.value ? iconsMap[field.value] : undefined;

        return (
          <Box display="flex" flexDirection="column" gap={2}>
            {label && <Typography fontWeight={600}>{label}</Typography>}

            <TextField
              placeholder="Search icon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
            />

            <Paper
              variant="outlined"
              sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}
            >
              <Typography>Preview:</Typography>
              {SelectedIcon ? (
                <SelectedIcon size={28} />
              ) : (
                <Typography color="text.secondary">None</Typography>
              )}
              <Typography>{field.value || "No icon selected"}</Typography>
            </Paper>

            <Box sx={{ border: "1px solid #eee", borderRadius: 2, p: 1 }}>
              <Grid container spacing={1}>
                {pageIcons.map((iconName) => {
                  const Icon = iconsMap[iconName];
                  if (!Icon) return null;
                  const isSelected = field.value === iconName;
                  return (
                    <Grid size={4} key={iconName}>
                      <Box
                        onClick={() => field.onChange(iconName)}
                        sx={{
                          cursor: "pointer",
                          p: 1,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: isSelected ? "2px solid #1976d2" : "1px solid transparent",
                          backgroundColor: isSelected ? "rgba(25,118,210,0.1)" : "transparent",
                          transition: "0.2s",
                          "&:hover": { backgroundColor: "#f5f5f5" },
                        }}
                      >
                        <Icon size={20} />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>

              {filteredIcons.length === 0 && (
                <Typography textAlign="center" mt={2} color="text.secondary">
                  No icons found
                </Typography>
              )}
            </Box>

            {totalPages > 1 && (
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                <IconButton size="small" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft />
                </IconButton>
                <Typography variant="body2">
                  {page + 1} / {totalPages}
                </Typography>
                <IconButton size="small" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight />
                </IconButton>
              </Stack>
            )}
          </Box>
        );
      }}
    />
  );
};

export default IconPicker;
