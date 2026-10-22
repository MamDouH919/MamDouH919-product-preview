import { useEffect } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import { useCheckTenant } from '../hooks/useTenants';

export function CheckDialog({ host, onClose }: { host: string; onClose: () => void }) {
  const check = useCheckTenant();
  const { mutate } = check;
  useEffect(() => mutate(host), [host, mutate]);
  const result = check.data;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Connection check</DialogTitle>
      <DialogContent>
        {check.isPending && (
          <Stack sx={{ py: 4, alignItems: "center" }}>
            <CircularProgress />
          </Stack>
        )}
        {check.error && <Alert severity="error">{check.error.message}</Alert>}
        {result && !result.ok && (
          <Alert severity="error" sx={{ wordBreak: 'break-word' }}>
            Could not reach the database: {result.error}
          </Alert>
        )}
        {result?.ok && (
          <>
            <Alert severity="success">{host} database is reachable.</Alert>
            <List dense>
              <ListItem>
                <ListItemText primary="Round trip" secondary={`${result.latencyMs} ms`} />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Transactions"
                  secondary={result.transactions ? 'Supported (replica set)' : 'Not available: finance writes will be refused'}
                />
              </ListItem>
              <ListItem>
                <ListItemText primary="Collections" secondary={result.collections} />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Admin users"
                  secondary={result.users ? result.users : 'None yet: seed the store to create one'}
                />
              </ListItem>
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => check.mutate(host)} disabled={check.isPending}>
          Run again
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
