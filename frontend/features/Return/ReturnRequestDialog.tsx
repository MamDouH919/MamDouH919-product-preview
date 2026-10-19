"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import { CreateReturnPayload, RETURN_REASONS, ReturnReason, ReturnableLine } from "@/backend-api/returns/types";
import { getBackendUri } from "@/utils/helperFunctions";
import { localized } from "@/features/Order/format";

/**
 * Picking what to send back: a quantity per line (0 to leave it out), a reason
 * and an optional note. Used by customers on their order and by admins
 * opening a return for a phone or in-store customer.
 */
export default function ReturnRequestDialog({
  open,
  orderId,
  lines,
  pending,
  title,
  hint,
  onClose,
  onSubmit,
}: {
  open: boolean;
  orderId: string;
  lines: ReturnableLine[];
  pending: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  onSubmit: (payload: CreateReturnPayload) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [note, setNote] = useState("");

  const chosen = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([lineIndex, quantity]) => ({ lineIndex: Number(lineIndex), quantity }));
  const canSubmit = chosen.length > 0 && !!reason && !pending;
  const step = (line: ReturnableLine, by: number) =>
    setQuantities((prev) => ({
      ...prev,
      [line.lineIndex]: Math.min(line.returnable, Math.max(0, (prev[line.lineIndex] ?? 0) + by)),
    }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} pt={1}>
          {hint && (
            <Typography variant="body2" color="text.secondary">
              {hint}
            </Typography>
          )}
          <Stack spacing={1.5}>
            {lines.map((line) => {
              const value = quantities[line.lineIndex] ?? 0;
              const disabled = line.returnable === 0;
              return (
                <Stack key={line.lineIndex} direction="row" spacing={1.5} alignItems="center" sx={{ opacity: disabled ? 0.5 : 1 }}>
                  <Avatar variant="rounded" src={line.image ? getBackendUri(line.image) ?? undefined : undefined} sx={{ width: 44, height: 44 }} />
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {localized(line.name, lang)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {line.variantLabel ? `${line.variantLabel} · ` : ""}
                      {disabled ? t("alreadyReturned") : t("canReturnUpTo", { count: line.returnable })}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton size="small" onClick={() => step(line, -1)} disabled={disabled || value === 0} aria-label={t("decrease")}>
                      <Remove fontSize="small" />
                    </IconButton>
                    <Typography width={24} textAlign="center" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {value}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => step(line, 1)}
                      disabled={disabled || value >= line.returnable}
                      aria-label={t("increase")}
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>

          <TextField select label={t("returnReasonLabel")} value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)} required fullWidth>
            {RETURN_REASONS.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`returnReason.${r}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("noteOptional")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={() => reason && onSubmit({ orderId, items: chosen, reason, note: note.trim() || undefined })}
        >
          {t("submitReturn")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
