import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
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
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import {
  ApiError,
  PRICE_KIND_LABELS,
  PRICE_SOURCE_LABELS,
  type PriceChange,
  type PriceKind,
  type PriceSource,
} from '../api';
import { usePriceChanges, usePriceChangeSummary } from '../hooks/usePriceChanges';
import { useTenants } from '../hooks/useTenants';

const DAYS = 7;
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KIND_COLOR: Record<PriceKind, 'primary' | 'secondary' | 'default'> = {
  price: 'primary',
  compareAtPrice: 'default',
  cost: 'secondary',
};

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

const amount = (v: number | null) => (v === null ? '—' : money.format(v));

/** The change itself: old → new, with how far it moved. Up and down get different colours, not good and bad: a cost rising and a price falling are both worth a look. */
function Movement({ change }: { change: PriceChange }) {
  const up = (change.delta ?? 0) > 0;
  const down = (change.delta ?? 0) < 0;
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {amount(change.oldValue)}
        </Box>
        {' → '}
        <Box component="span" sx={{ fontWeight: 650 }}>
          {amount(change.newValue)}
        </Box>
      </Typography>
      {change.delta !== null && change.delta !== 0 && (
        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', color: up ? 'warning.main' : 'info.main' }}>
          {up ? <ArrowUpward sx={{ fontSize: 14 }} /> : down ? <ArrowDownward sx={{ fontSize: 14 }} /> : null}
          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {money.format(Math.abs(change.delta))}
            {change.deltaPercent !== null && ` (${change.deltaPercent > 0 ? '+' : ''}${change.deltaPercent}%)`}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

/** A date input's value (yyyy-mm-dd) as the start or end of that day in the viewer's time zone. */
const dayBound = (value: string, end: boolean) =>
  value ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString() : undefined;

export function PriceChangesPage() {
  const tenants = useTenants();
  const [host, setHost] = useState('');
  const [kind, setKind] = useState<PriceKind | ''>('');
  const [source, setSource] = useState<PriceSource | ''>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const changes = usePriceChanges({
    host: host || undefined,
    kind: kind || undefined,
    source: source || undefined,
    q: q || undefined,
    from: dayBound(from, false),
    to: dayBound(to, true),
    page: page + 1,
    limit,
  });
  const summary = usePriceChangeSummary(DAYS, host || undefined);

  const stores = (tenants.data ?? []).filter((t) => !t.aliasOf);
  /** Any filter change starts again from the first page. */
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const items = changes.data?.items ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Price changes</Typography>
        <Typography variant="body2" color="text.secondary">
          Every change to a product&apos;s selling price or cost, in every store. Read-only; kept for about a year.
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Stat label={`Changes, last ${DAYS} days`} value={summary.data?.total} loading={summary.isLoading} />
        <Stat label="Selling prices" value={summary.data?.byKind.price} loading={summary.isLoading} />
        <Stat label="Costs" value={summary.data?.byKind.cost} loading={summary.isLoading} />
        <Stat label="Products touched" value={summary.data?.products} loading={summary.isLoading} />
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Product, variant or SKU"
            value={search}
            onChange={(e) => filter(setSearch)(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField select size="small" label="Store" value={host} onChange={(e) => filter(setHost)(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All stores</MenuItem>
            {stores.map((t) => (
              <MenuItem key={t.host} value={t.host}>
                {t.host}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="What changed" value={kind} onChange={(e) => filter(setKind)(e.target.value as PriceKind | '')} sx={{ minWidth: 170 }}>
            <MenuItem value="">Price and cost</MenuItem>
            {(Object.keys(PRICE_KIND_LABELS) as PriceKind[]).map((k) => (
              <MenuItem key={k} value={k}>
                {PRICE_KIND_LABELS[k]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Cause" value={source} onChange={(e) => filter(setSource)(e.target.value as PriceSource | '')} sx={{ minWidth: 190 }}>
            <MenuItem value="">Any cause</MenuItem>
            {(Object.keys(PRICE_SOURCE_LABELS) as PriceSource[]).map((s) => (
              <MenuItem key={s} value={s}>
                {PRICE_SOURCE_LABELS[s]}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="date" label="From" value={from} onChange={(e) => filter(setFrom)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="To" value={to} onChange={(e) => filter(setTo)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      </Paper>

      {changes.error && (
        <Alert severity="error">{changes.error instanceof ApiError ? changes.error.message : 'Could not load price changes'}</Alert>
      )}

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Store</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Change</TableCell>
                <TableCell>Cause</TableCell>
                <TableCell>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changes.isLoading &&
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))}
              {items.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateTime.format(new Date(c.at))}</TableCell>
                  <TableCell>{c.host}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.productName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[c.variantLabel, c.sku].filter(Boolean).join(' · ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={KIND_COLOR[c.kind]} label={PRICE_KIND_LABELS[c.kind]} />
                  </TableCell>
                  <TableCell>
                    <Movement change={c} />
                  </TableCell>
                  <TableCell>{PRICE_SOURCE_LABELS[c.source]}</TableCell>
                  <TableCell>
                    {c.userName ? (
                      <Tooltip title={c.userEmail ?? ''}>
                        <span>{c.userName}</span>
                      </Tooltip>
                    ) : (
                      <Typography color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!changes.isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No price changes match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={changes.data?.total ?? 0}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={[25, 50, 100]}
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
