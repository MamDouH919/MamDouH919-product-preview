"use client";

import { Box, IconButton, MenuItem, Select, Stack, Typography } from "@mui/material";
import FirstPage from "@mui/icons-material/FirstPage";
import LastPage from "@mui/icons-material/LastPage";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { useTranslation } from "react-i18next";

export type PagerProps = {
  count: number;
  /** 0-based */
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
};

// Page numbers to show: first, last, and a window around the current page, with gaps as null.
const pageWindow = (page: number, pages: number): (number | null)[] => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const set = new Set([0, pages - 1, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((n) => set.add(n));
  if (page >= pages - 3) [pages - 2, pages - 3, pages - 4].forEach((n) => set.add(n));
  const sorted = [...set].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
};

const Pager = ({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [25, 50, 100],
}: PagerProps) => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === "rtl";
  const pages = Math.max(1, Math.ceil(count / rowsPerPage));
  const from = count === 0 ? 0 : page * rowsPerPage + 1;
  const to = Math.min(count, (page + 1) * rowsPerPage);
  const nf = new Intl.NumberFormat(i18n.language);

  // Arrows follow the reading direction: "previous" points right in RTL.
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const First = rtl ? LastPage : FirstPage;
  const Last = rtl ? FirstPage : LastPage;

  const btn = (label: string, disabled: boolean, onClick: () => void, icon: React.ReactNode) => (
    <IconButton size="small" aria-label={label} disabled={disabled} onClick={onClick} sx={{ borderRadius: 1.5 }}>
      {icon}
    </IconButton>
  );

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={1}
      sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider", flexShrink: 0 }}
    >
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Typography variant="body2" color="text.secondary">
          {t("rowsPerPage", { defaultValue: "Rows" })}
        </Typography>
        <Select
          size="small"
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          sx={{ fontSize: 13, "& .MuiSelect-select": { py: 0.5, px: 1.25 }, borderRadius: 2 }}
        >
          {rowsPerPageOptions.map((o) => (
            <MenuItem key={o} value={o}>
              {nf.format(o)}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
          {nf.format(from)}–{nf.format(to)} / {nf.format(count)}
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" gap={0.25}>
        {btn("first", page === 0, () => onPageChange(0), <First fontSize="small" />)}
        {btn("previous", page === 0, () => onPageChange(page - 1), <Prev fontSize="small" />)}
        <Stack direction="row" gap={0.25} sx={{ display: { xs: "none", md: "flex" } }}>
          {pageWindow(page, pages).map((n, i) =>
            n === null ? (
              <Box key={`gap${i}`} sx={{ px: 0.5, color: "text.disabled", alignSelf: "center" }}>
                …
              </Box>
            ) : (
              <IconButton
                key={n}
                size="small"
                onClick={() => onPageChange(n)}
                aria-current={n === page ? "page" : undefined}
                sx={{
                  minWidth: 32,
                  height: 32,
                  borderRadius: 1.5,
                  fontSize: 13,
                  fontWeight: n === page ? 700 : 500,
                  color: n === page ? "primary.contrastText" : "text.primary",
                  bgcolor: n === page ? "primary.main" : "transparent",
                  "&:hover": { bgcolor: n === page ? "primary.dark" : "action.hover" },
                }}
              >
                {nf.format(n + 1)}
              </IconButton>
            )
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "block", md: "none" }, px: 1 }}>
          {nf.format(page + 1)} / {nf.format(pages)}
        </Typography>
        {btn("next", page >= pages - 1, () => onPageChange(page + 1), <Next fontSize="small" />)}
        {btn("last", page >= pages - 1, () => onPageChange(pages - 1), <Last fontSize="small" />)}
      </Stack>
    </Stack>
  );
};

export default Pager;
