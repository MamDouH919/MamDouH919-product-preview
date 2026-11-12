import { Fragment, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { ApiError, type ErrorGroup, type ErrorStatus } from '../api';
import { useDeleteError, useErrors, useErrorStats, useUpdateError } from '../hooks/useErrors';
import { useTenants } from '../hooks/useTenants';

const STATUS_COLOR: Record<ErrorStatus, 'error' | 'success' | 'default'> = {
  new: 'error',
  resolved: 'success',
  ignored: 'default',
};
const DAYS = 14;
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Stat({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <Paper sx={{ p: 2.5, flex: 1, minWidth: 140 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 650, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
        {loading ? <Skeleton width={48} /> : (value ?? 0)}
      </Typography>
    </Paper>
  );
}

/** Errors per day as plain bars: no chart library for one series. */
function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120 }}>
      {data.map((d) => (
        <Tooltip key={d.date} title={`${d.date}: ${d.count}`}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
            <Box
              sx={{
                width: '100%',
                height: `${(d.count / max) * 100}%`,
                minHeight: d.count ? 3 : 1,
                bgcolor: d.count ? 'error.main' : 'divider',
                borderRadius: 0.5,
              }}
            />
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

function ErrorRow({ group }: { group: ErrorGroup }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(group.note ?? '');
  const update = useUpdateError();
  const remove = useDeleteError();

  return (
    <Fragment>
      <TableRow hover sx={{ '& > td': { borderBottom: open ? 'none' : undefined } }}>
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={() => setOpen(!open)} aria-label="Details">
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ maxWidth: 380 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {group.name}: {group.message}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {group.method} {group.route}
          </Typography>
        </TableCell>
        <TableCell>{group.host}</TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {group.statusCode}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {group.count}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateTime.format(new Date(group.lastSeen))}</TableCell>
        <TableCell>
          <TextField
            select
            size="small"
            value={group.status}
            onChange={(e) => update.mutate({ id: group.id, status: e.target.value as ErrorStatus })}
            slotProps={{ select: { renderValue: (v) => <Chip size="small" color={STATUS_COLOR[v as ErrorStatus]} label={String(v)} /> } }}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="ignored">Ignored</MenuItem>
          </TextField>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Stack spacing={2} sx={{ py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                First seen {dateTime.format(new Date(group.firstSeen))}
                {group.resolvedAt && ` · resolved ${dateTime.format(new Date(group.resolvedAt))}`}
              </Typography>
              <Box
                component="pre"
                sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', maxHeight: 260, fontSize: 12 }}
              >
                {group.stack ?? group.message}
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  label="Note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  variant="outlined"
                  disabled={note === (group.note ?? '') || update.isPending}
                  onClick={() => update.mutate({ id: group.id, note })}
                >
                  Save
                </Button>
                <Tooltip title="Delete this error">
                  <IconButton color="error" disabled={remove.isPending} onClick={() => remove.mutate(group.id)}>
                    <DeleteOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

export function ErrorsPage() {
  const tenants = useTenants();
  const stats = useErrorStats(DAYS);
  const [filters, setFilters] = useState<{ host: string; status: ErrorStatus | ''; statusCode: string; q: string }>({
    host: '',
    status: 'new',
    statusCode: '',
    q: '',
  });
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);

  const errors = useErrors({
    host: filters.host || undefined,
    status: filters.status || undefined,
    statusCode: filters.statusCode ? Number(filters.statusCode) : undefined,
    q: filters.q.trim() || undefined,
    page: page + 1,
    limit,
  });

  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const hosts = ['platform', ...(tenants.data?.map((t) => t.host) ?? [])];
  const loadError = errors.error ?? stats.error;

  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 650 }}>
        Errors
      </Typography>

      {loadError && (
        <Alert severity="error">{loadError instanceof ApiError ? loadError.message : 'Could not load errors.'}</Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Stat label="Open errors" value={stats.data?.totals.new} loading={stats.isLoading} />
        <Stat label="Resolved" value={stats.data?.totals.resolved} loading={stats.isLoading} />
        <Stat label="Ignored" value={stats.data?.totals.ignored} loading={stats.isLoading} />
        <Stat label={`Occurrences, ${DAYS} days`} value={stats.data?.totals.events} loading={stats.isLoading} />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 2.5, flex: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Errors per day, last {DAYS} days
          </Typography>
          {stats.data ? <DailyChart data={stats.data.perDay} /> : <Skeleton variant="rounded" height={120} />}
        </Paper>
        <Paper sx={{ p: 2.5, flex: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Most affected
          </Typography>
          {stats.data?.byHost.length === 0 && <Typography variant="body2">No errors. 🎉</Typography>}
          <Stack spacing={0.75}>
            {stats.data?.byHost.map((h) => (
              <Stack key={h.host} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" noWrap>
                  {h.host}
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {h.count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          size="small"
          placeholder="Search message, route or error"
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
        />
        <TextField select size="small" label="Store" value={filters.host} onChange={(e) => set('host', e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All stores</MenuItem>
          {hosts.map((h) => (
            <MenuItem key={h} value={h}>
              {h}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={filters.status} onChange={(e) => set('status', e.target.value as ErrorStatus | '')} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="new">New</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
          <MenuItem value="ignored">Ignored</MenuItem>
        </TextField>
        <TextField select size="small" label="Code" value={filters.statusCode} onChange={(e) => set('statusCode', e.target.value)} sx={{ minWidth: 110 }}>
          <MenuItem value="">Any</MenuItem>
          {[409, 500, 501, 502, 503, 504].map((c) => (
            <MenuItem key={c} value={String(c)}>
              {c}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Error</TableCell>
                <TableCell>Store</TableCell>
                <TableCell align="right">Code</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell>Last seen</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {errors.isLoading &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))}
              {errors.data?.items.map((g) => <ErrorRow key={g.id} group={g} />)}
              {errors.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No errors match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={errors.data?.total ?? 0}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={[20, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(0);
          }}
        />
      </Paper>
    </Stack>
  );
}
