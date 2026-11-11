import { useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Backup from '@mui/icons-material/Backup';
import Download from '@mui/icons-material/Download';
import Restore from '@mui/icons-material/Restore';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { ApiError, api, type Backup as BackupItem, type BackupKind, type RestoreReport } from '../api';
import { useBackups, useCreateBackup, useRestoreBackup } from '../hooks/useTenants';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const KIND_LABELS: Record<BackupKind, string> = {
  daily: 'Daily',
  manual: 'Manual',
  'pre-restore': 'Before restore',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupsDialog({ host, onClose }: { host: string; onClose: () => void }) {
  const backups = useBackups(host);
  const create = useCreateBackup(host);
  const [restoring, setRestoring] = useState<BackupItem | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (id: string) => {
    setDownloadError(null);
    setDownloading(id);
    try {
      await api.downloadBackup(host, id);
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  if (restoring) {
    return <RestoreView host={host} backup={restoring} onBack={() => setRestoring(null)} onClose={onClose} />;
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Backups · {host}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Taken every night at 00:00 (Cairo) and kept for 3 days, in the private backup bucket. Images are not part of
            a backup; they stay in R2.
          </Typography>
          {backups.error && <Alert severity="error">{backups.error.message}</Alert>}
          {create.error && <Alert severity="error">{create.error.message}</Alert>}
          {downloadError && <Alert severity="error">{downloadError}</Alert>}
          {create.isSuccess && <Alert severity="success">Backup {create.data.id} saved.</Alert>}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Taken</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.isPending &&
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    {[0, 1, 2, 3].map((j) => (
                      <TableCell key={j}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {backups.data?.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {dateTime.format(new Date(b.createdAt))}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={b.kind === 'pre-restore' ? 'warning' : b.kind === 'manual' ? 'primary' : 'default'}
                      label={KIND_LABELS[b.kind]}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSize(b.size)}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Download (.json.gz)">
                      <span>
                        <IconButton size="small" onClick={() => download(b.id)} loading={downloading === b.id}>
                          <Download fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Restore this backup">
                      <IconButton size="small" onClick={() => setRestoring(b)}>
                        <Restore fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {backups.isSuccess && backups.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center', borderBottom: 0 }}>
                    <Typography color="text.secondary">No backups yet. The first one runs tonight, or take one now.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button startIcon={<Backup />} onClick={() => create.mutate()} loading={create.isPending}>
          Back up now
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReportSummary({ report }: { report: RestoreReport }) {
  const total = report.collections.reduce((sum, c) => sum + c.documents, 0);
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {total.toLocaleString()} documents in {report.collections.length} collections
        {report.exportedAt ? `, taken ${dateTime.format(new Date(report.exportedAt))}` : ''}.
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {report.collections
          .filter((c) => c.documents > 0)
          .map((c) => (
            <Chip key={c.name} size="small" variant="outlined" label={`${c.name} · ${c.documents}`} />
          ))}
      </Stack>
      {report.skipped.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Skipped (not used any more): {report.skipped.join(', ')}
        </Typography>
      )}
    </Box>
  );
}

function RestoreView({
  host,
  backup,
  onBack,
  onClose,
}: {
  host: string;
  backup: BackupItem;
  onBack: () => void;
  onClose: () => void;
}) {
  const check = useRestoreBackup(host);
  const restore = useRestoreBackup(host);
  const [typed, setTyped] = useState('');
  const { mutate: runCheck } = check;
  useEffect(() => runCheck({ id: backup.id, dryRun: true }), [backup.id, runCheck]);

  const report = check.data;
  const checkReport = (check.error instanceof ApiError && (check.error.data as { report?: RestoreReport })?.report) || null;
  const restoreReport = (restore.error instanceof ApiError && (restore.error.data as { report?: RestoreReport })?.report) || null;
  const errors = report?.errors ?? checkReport?.errors ?? restoreReport?.errors ?? [];
  const canRestore = Boolean(report) && errors.length === 0 && typed.trim() === host && !restore.isSuccess;

  return (
    <Dialog open onClose={restore.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={onBack} disabled={restore.isPending} aria-label="Back to backups">
          <ArrowBack fontSize="small" />
        </IconButton>
        Restore {dateTime.format(new Date(backup.createdAt))}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {check.isPending && (
            <Stack sx={{ py: 4, alignItems: 'center', gap: 1 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Checking the backup against the current schemas…
              </Typography>
            </Stack>
          )}
          {check.error && <Alert severity="error">{check.error.message}</Alert>}

          {restore.isSuccess ? (
            <Alert severity="success">
              <AlertTitle>{host} restored</AlertTitle>
              The state from just before the restore was saved as <strong>{restore.data.safetyBackup}</strong>; restore it
              to undo this. Everyone signed in to the store has to sign in again.
            </Alert>
          ) : (
            report && (
              <>
                <ReportSummary report={report} />
                {errors.length > 0 ? (
                  <Alert severity="error">
                    <AlertTitle>This backup can't be restored</AlertTitle>
                    Some documents don't pass the current schemas:
                    <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13 }}>
                      {errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </Box>
                  </Alert>
                ) : (
                  <Alert severity="warning">
                    <AlertTitle>Everything after this backup is lost</AlertTitle>
                    The store's orders, products, customers, finance and settings are replaced with this backup's. Orders
                    placed since then disappear. A backup of the current state is taken first, so this can be undone.
                    Everyone has to sign in again.
                  </Alert>
                )}
                {restore.error && <Alert severity="error">{restore.error.message}</Alert>}
                {errors.length === 0 && (
                  <TextField
                    label={`Type ${host} to confirm`}
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    disabled={restore.isPending}
                  />
                )}
              </>
            )
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {restore.isSuccess ? (
          <Button variant="contained" onClick={onBack}>
            Back to backups
          </Button>
        ) : (
          <>
            <Button onClick={onBack} disabled={restore.isPending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={!canRestore}
              loading={restore.isPending}
              onClick={() => restore.mutate({ id: backup.id, dryRun: false, confirm: typed.trim() })}
            >
              Restore
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
