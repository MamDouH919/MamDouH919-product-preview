"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { formatMoney } from "@/features/Order/format";

type Point = { date: string; revenue: number; orders: number };

/** Rounds up to 1, 2 or 5 × 10ⁿ so gridline labels are numbers people read at a glance. */
const niceCeil = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
};

const compact = (value: number, lang: string) =>
  new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );

/**
 * Revenue per day as bars. One series, so no legend — the card title names it.
 * Each bar's hit area is the full column height, and hovering shows the day's
 * revenue and order count.
 */
const RevenueChart = ({ series, currency, height = 220 }: { series: Point[]; currency: string; height?: number }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const theme = useTheme();

  const max = useMemo(() => niceCeil(Math.max(0, ...series.map((p) => p.revenue))), [series]);
  const gridlines = [max, max / 2, 0];

  const dayLabel = (date: string, withWeekday = false) =>
    // Noon UTC keeps the label on the right day in every zone.
    new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      ...(withWeekday ? { weekday: "short" } : {}),
    });

  // A handful of evenly spread dates — never one under every bar.
  const tickEvery = Math.max(1, Math.ceil(series.length / 6));

  return (
    <Stack direction="row" spacing={1} sx={{ height: height + 24 }}>
      {/* Y axis labels */}
      <Box sx={{ position: "relative", height, minWidth: 36 }}>
        {gridlines.map((value) => (
          <Typography
            key={value}
            variant="caption"
            color="text.secondary"
            sx={{
              position: "absolute",
              insetInlineEnd: 0,
              top: `${(1 - value / max) * 100}%`,
              transform: "translateY(-50%)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {compact(value, lang)}
          </Typography>
        ))}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ position: "relative", height }}>
          {/* Recessive gridlines */}
          {gridlines.map((value) => (
            <Box
              key={value}
              sx={{
                position: "absolute",
                insetInline: 0,
                top: `${(1 - value / max) * 100}%`,
                borderTop: 1,
                borderColor: "divider",
                borderStyle: value === 0 ? "solid" : "dashed",
              }}
            />
          ))}

          <Stack direction="row" alignItems="flex-end" sx={{ position: "absolute", inset: 0, gap: "2px" }}>
            {series.map((point) => (
              <Tooltip
                key={point.date}
                arrow
                disableInteractive
                title={
                  <Stack spacing={0.25}>
                    <Typography variant="caption" fontWeight={700}>
                      {dayLabel(point.date, true)}
                    </Typography>
                    <Typography variant="caption">{formatMoney(point.revenue, currency)}</Typography>
                    <Typography variant="caption">
                      {t("ordersCount", { count: point.orders })}
                    </Typography>
                  </Stack>
                }
              >
                <Box
                  sx={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    cursor: "default",
                    "&:hover > div": { opacity: 0.75 },
                  }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      maxWidth: 28,
                      mx: "auto",
                      // A sliver for any non-zero day so a small sale never looks like none.
                      height: point.revenue > 0 ? `max(3px, ${(point.revenue / max) * 100}%)` : 0,
                      bgcolor: theme.palette.primary.main,
                      borderRadius: "4px 4px 0 0",
                      transition: "height 400ms ease, opacity 120ms",
                    }}
                  />
                </Box>
              </Tooltip>
            ))}
          </Stack>
        </Box>

        {/* X axis */}
        <Stack direction="row" sx={{ gap: "2px", mt: 0.75 }}>
          {series.map((point, i) => (
            <Box key={point.date} sx={{ flex: 1, minWidth: 0, position: "relative", height: 16 }}>
              {/* The last day always gets a label; the regular tick before it is dropped if they'd collide. */}
              {((i % tickEvery === 0 && series.length - 1 - i >= tickEvery / 2) || i === series.length - 1) && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ position: "absolute", left: "50%", transform: "translateX(-50%)", lineHeight: 1.4 }}
                >
                  {dayLabel(point.date)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};

export default RevenueChart;
