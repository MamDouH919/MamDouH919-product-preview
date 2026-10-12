"use client";

import { useTranslation } from "react-i18next";
import { Box, Stack, Typography } from "@mui/material";
import { OrderStatusChange } from "@/backend-api/orders/types";
import { formatDateTime } from "./format";

/** Oldest first; shows who made each change when the history carries it (admin view). */
const StatusTimeline = ({ history }: { history: OrderStatusChange[] }) => {
  const { t, i18n } = useTranslation();

  return (
    <Stack spacing={0}>
      {history.map((change, i) => {
        const last = i === history.length - 1;
        const by = typeof change.by === "object" ? change.by?.name : undefined;
        return (
          <Stack key={i} direction="row" spacing={1.5}>
            <Stack alignItems="center">
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  mt: 0.5,
                  borderRadius: "50%",
                  bgcolor: last ? "primary.main" : "grey.400",
                  flexShrink: 0,
                }}
              />
              {!last && <Box sx={{ width: 2, flex: 1, bgcolor: "grey.300", my: 0.5 }} />}
            </Stack>
            <Box pb={last ? 0 : 2}>
              <Typography variant="body2" fontWeight={600}>
                {t(`orderStatus.${change.status}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {formatDateTime(change.at, i18n.language)}
                {by ? ` · ${by}` : ""}
              </Typography>
              {change.note && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: "italic" }}>
                  {change.note}
                </Typography>
              )}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
};

export default StatusTimeline;
