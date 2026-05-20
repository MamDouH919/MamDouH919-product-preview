"use client";

import { useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { exportDatabase, importDatabase } from "@/backend-api/database/mutations";

const DatabasePage = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const exportMutation = useMutation({
    mutationFn: exportDatabase,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    },
    onError: () => toast.error(t("somethingWentWrong")),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importDatabase(file),
    onSuccess: () => {
      toast.success(t("importSuccess"));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: () => toast.error(t("somethingWentWrong")),
  });

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
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t("chooseFile")}
          </Button>

          {selectedFile && (
            <>
              <Box
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: "grey.100",
                  fontSize: "0.85rem",
                  color: "text.secondary",
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedFile.name}
              </Box>
              <Button
                variant="contained"
                color="error"
                disabled={importMutation.isPending}
                startIcon={
                  importMutation.isPending
                    ? <CircularProgress size={18} color="inherit" />
                    : null
                }
                onClick={() => importMutation.mutate(selectedFile)}
              >
                {t("importDatabase")}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};

export default DatabasePage;
