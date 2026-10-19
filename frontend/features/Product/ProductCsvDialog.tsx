"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  ChipProps,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { importProductsCsv, ProductImportReport, ProductImportRow } from "@/backend-api/products/queries";
import { PRODUCTS_QUERY_KEY } from "@/backend-api/products/hooks";

const ACTION_COLORS: Record<ProductImportRow["action"], ChipProps["color"]> = {
  create: "success",
  update: "info",
  unchanged: "default",
  error: "error",
};

/**
 * Upload → preview → apply. The first upload only asks the server what would
 * change; nothing is written until "Apply" — and that's offered only when the
 * preview has no errors.
 */
export default function ProductCsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ProductImportReport | null>(null);

  const onError = (error: any) => {
    const message = error?.response?.data?.message;
    toast.error(Array.isArray(message) ? message[0] : message ?? t("somethingWentWrong"));
  };

  const preview = useMutation({
    mutationFn: (f: File) => importProductsCsv({ file: f, apply: false }),
    onSuccess: setReport,
    onError,
  });

  const apply = useMutation({
    mutationFn: () => importProductsCsv({ file: file!, apply: true }),
    onSuccess: (result) => {
      setReport(result);
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (result.summary.error === 0) toast.success(t("importDone"));
    },
    onError,
  });

  const reset = () => {
    setFile(null);
    setReport(null);
    preview.reset();
    apply.reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const busy = preview.isPending || apply.isPending;
  const changed = report ? report.summary.create + report.summary.update : 0;
  // Unchanged rows are noise in a long file — show what matters.
  const visible = report?.rows.filter((r) => r.action !== "unchanged") ?? [];

  return (
    <Dialog open={open} onClose={busy ? undefined : close} fullWidth maxWidth="md">
      <DialogTitle>{t("importProducts")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} pt={1}>
          <Typography variant="body2" color="text.secondary">
            {t("importProductsHint")}
          </Typography>

          <Box>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (!picked) return;
                setFile(picked);
                setReport(null);
                preview.mutate(picked);
              }}
            />
            <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={() => inputRef.current?.click()} disabled={busy}>
              {file ? file.name : t("chooseCsvFile")}
            </Button>
          </Box>

          {busy && <LinearProgress />}

          {report && (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color="success" variant="outlined" label={t("importNew", { count: report.summary.create })} />
                <Chip color="info" variant="outlined" label={t("importUpdated", { count: report.summary.update })} />
                <Chip variant="outlined" label={t("importUnchanged", { count: report.summary.unchanged })} />
                {report.summary.error > 0 && (
                  <Chip color="error" variant="outlined" label={t("importErrors", { count: report.summary.error })} />
                )}
              </Stack>

              {report.applied ? (
                <Alert severity={report.summary.error ? "warning" : "success"}>
                  {report.summary.error ? t("importStoppedPartway") : t("importApplied")}
                </Alert>
              ) : report.summary.error > 0 ? (
                <Alert severity="error">{t("importFixErrors")}</Alert>
              ) : changed === 0 ? (
                <Alert severity="info">{t("importNothingToChange")}</Alert>
              ) : (
                <Alert severity="info">{t("importPreviewOnly")}</Alert>
              )}

              {visible.length > 0 && (
                <Stack spacing={1} sx={{ maxHeight: 360, overflow: "auto", pr: 1 }}>
                  {visible.map((row) => (
                    <Box key={`${row.line}-${row.product}`} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={row.changes.length || row.errors.length ? 0.75 : 0}>
                        <Chip size="small" color={ACTION_COLORS[row.action]} label={t(`importAction.${row.action}`)} />
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {row.product}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("csvLine", { line: row.line })}
                        </Typography>
                      </Stack>
                      {row.changes.length > 0 && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.changes.join(" · ")}
                        </Typography>
                      )}
                      {row.errors.map((e) => (
                        <Typography key={e} variant="caption" color="error.main" display="block">
                          {e}
                        </Typography>
                      ))}
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>
          {report?.applied ? t("close") : t("cancel")}
        </Button>
        {report && !report.applied && (
          <Button
            variant="contained"
            disabled={busy || report.summary.error > 0 || changed === 0}
            onClick={() => apply.mutate()}
          >
            {t("applyChanges", { count: changed })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
