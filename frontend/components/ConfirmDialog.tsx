"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useTranslation } from "react-i18next";

/** "Are you sure?" for destructive actions. Open while `title` is set. */
const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  title: string | null;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={!!title} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText>{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button color="error" variant="contained" disabled={loading} onClick={onConfirm}>
          {confirmLabel ?? t("delete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
