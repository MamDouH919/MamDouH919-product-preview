import { useState, type ReactNode } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField } from '@mui/material';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** When set, the button stays disabled until this exact text is typed. */
  typeToConfirm?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, typeToConfirm, destructive, pending, error, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error.message}</Alert>}
          <DialogContentText component="div">{children}</DialogContentText>
          {typeToConfirm !== undefined && (
            <TextField
              label={`Type ${typeToConfirm} to confirm`}
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={blocked}
          loading={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
