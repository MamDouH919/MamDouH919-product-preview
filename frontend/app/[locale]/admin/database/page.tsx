"use client";

import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { exportDatabase, importDatabase, ImportReport } from "@/backend-api/database/mutations";
import { getBackendUrl } from "@/lib/getBackendUrl";

/** The host the API resolves this store by — what the import asks to be typed back. */
const storeHost = () => {
  try {
    return new URL(getBackendUrl()).hostname;
  } catch {
    return "";
  }
};

const serverMessage = (error: any): string | undefined => {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(", ") : message;
};

const DatabasePage = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const host = useMemo(() => storeHost(), []);

  const resetImport = () => {
    setSelectedFile(null);
    setReport(null);
    setPassword("");
    setConfirm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportMutation = useMutation({
    mutationFn: exportDatabase,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `store-export-${host}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    },
    onError: () => toast.error(t("somethingWentWrong")),
  });

  // Always a dry run first: the server checks the file and reports what it would do.
  const importMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      importDatabase({ file: selectedFile!, password, confirm, dryRun }),
    onSuccess: (result) => {
      if (result.imported) {
        toast.success(t("importSuccess"));
        resetImport();
      } else {
        setReport(result);
      }
    },
    onError: (error: any) => {
      const refused = error?.response?.data?.report as ImportReport | undefined;
      if (refused) setReport(refused);
      toast.error(serverMessage(error) ?? t("somethingWentWrong"));
    },
  });

  const canSubmit = !!selectedFile && !!password && confirm.trim().toLowerCase() === host.toLowerCase();
  const readyToImport = !!report && report.errors.length === 0 && report.blockers.length === 0;

  return (
    <Stack spacing={4} maxWidth={600}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <StorageOutlinedIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>
          {t("database")}
        </Typography>
      </Stack>

      {/* Export */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
          {t("exportDatabase")}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2.5}>
          {t("exportDatabaseDesc")}
        </Typography>
        <Button
          variant="contained"
          startIcon={
            exportMutation.isPending
              ? <CircularProgress size={18} color="inherit" />
              : <DownloadIcon />
          }
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          {t("exportDatabase")}
        </Button>
      </Paper>

      <Divider />

      {/* Import */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
          {t("importDatabase")}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2.5}>
          {t("importDatabaseDesc")}
        </Typography>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => {
            setSelectedFile(e.target.files?.[0] ?? null);
            setReport(null);
          }}
        />

        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t("chooseFile")}
            </Button>
            {selectedFile && (
              <Box
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: "grey.100",
                  fontSize: "0.85rem",
                  color: "text.secondary",
                  maxWidth: 240,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedFile.name}
              </Box>
            )}
          </Stack>

          {selectedFile && (
            <>
              <TextField
                type="password"
                size="small"
                label={t("importPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <TextField
                size="small"
                label={t("importConfirmLabel", { host })}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                inputProps={{ dir: "ltr", spellCheck: false }}
              />

              {report && (
                <Alert severity={readyToImport ? "info" : "error"}>
                  <Typography variant="body2" fontWeight={600} mb={0.5}>
                    {readyToImport ? t("importReady") : t("importBlocked")}
                  </Typography>
                  {report.collections.map((c) => (
                    <Typography key={c.name} variant="body2">
                      {c.name}: {t("documentsCount", { count: c.documents })}
                    </Typography>
                  ))}
                  {[...report.blockers, ...report.errors].map((line, i) => (
                    <Typography key={i} variant="body2" color="error">
                      {line}
                    </Typography>
                  ))}
                  {report.skipped.length > 0 && (
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {t("importSkipped")}: {report.skipped.join(", ")}
                    </Typography>
                  )}
                </Alert>
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  disabled={!canSubmit || importMutation.isPending}
                  onClick={() => importMutation.mutate(true)}
                >
                  {t("checkFile")}
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  disabled={!canSubmit || !readyToImport || importMutation.isPending}
                  startIcon={
                    importMutation.isPending
                      ? <CircularProgress size={18} color="inherit" />
                      : null
                  }
                  onClick={() => importMutation.mutate(false)}
                >
                  {t("importNow")}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};

export default DatabasePage;
