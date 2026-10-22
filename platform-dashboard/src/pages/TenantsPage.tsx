import { useMemo, useState, type MouseEvent } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Search from '@mui/icons-material/Search';
import MoreVert from '@mui/icons-material/MoreVert';
import EditOutlined from '@mui/icons-material/EditOutlined';
import NetworkCheck from '@mui/icons-material/NetworkCheck';
import PersonAddAlt from '@mui/icons-material/PersonAddAlt';
import PauseCircleOutlined from '@mui/icons-material/PauseCircleOutlined';
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { ApiError, type Tenant } from '../api';
import { useDeleteTenant, useTenants, useUpdateTenant } from '../hooks/useTenants';
import { TenantFormDialog } from '../components/TenantFormDialog';
import { CheckDialog } from '../components/CheckDialog';
import { SeedDialog } from '../components/SeedDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Filter = 'all' | 'active' | 'disabled';
type DialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'check' | 'seed' | 'toggle' | 'delete'; tenant: Tenant }
  | null;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function Stat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <Paper sx={{ p: 2.5, flex: 1, minWidth: 140 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 650, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
        {loading ? <Skeleton width={48} /> : value}
      </Typography>
    </Paper>
  );
}

function StatusChip({ tenant, tenants }: { tenant: Tenant; tenants: Tenant[] }) {
  const parentDisabled = tenant.aliasOf && tenants.find((t) => t.host === tenant.aliasOf)?.disabled;
  if (tenant.disabled) return <Chip size="small" label="Disabled" />;
  if (parentDisabled) return <Chip size="small" label="Parent disabled" />;
  return <Chip size="small" color="success" variant="outlined" label="Active" />;
}

export function TenantsPage() {
  const tenants = useTenants();
  const update = useUpdateTenant();
  const remove = useDeleteTenant();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; tenant: Tenant } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const all = useMemo(() => tenants.data ?? [], [tenants.data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (t) =>
        (filter === 'all' || (filter === 'disabled') === t.disabled) &&
        (!q || t.host.includes(q) || t.frontendUrl.toLowerCase().includes(q) || t.database.toLowerCase().includes(q)),
    );
  }, [all, search, filter]);

  const stores = all.filter((t) => !t.aliasOf);
  const stats = {
    stores: stores.length,
    active: stores.filter((t) => !t.disabled).length,
    disabled: stores.filter((t) => t.disabled).length,
    aliases: all.length - stores.length,
  };

  const closeDialog = () => {
    update.reset();
    remove.reset();
    setDialog(null);
  };
  const openFromMenu = (kind: 'edit' | 'check' | 'seed' | 'toggle' | 'delete') => {
    if (menu) setDialog({ kind, tenant: menu.tenant });
    setMenu(null);
  };

  const notConfigured = tenants.error instanceof ApiError && tenants.error.status === 503;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' } }}>
        <Box>
          <Typography variant="h5">Stores</Typography>
          <Typography variant="body2" color="text.secondary">
            Every host the API serves, and the database it routes to. Changes apply within seconds, with no restart.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ kind: 'create' })} disabled={notConfigured}>
          Add store
        </Button>
      </Stack>

      {notConfigured ? (
        <Alert severity="warning">
          <AlertTitle>Tenant registry is not configured</AlertTitle>
          The API is still reading tenants from TENANT_MAP or src/config.json. Set <code>PLATFORM_MONGO_URL</code> in the
          backend's .env to a database of its own and restart it. Existing tenants are imported on first start.
        </Alert>
      ) : tenants.error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => tenants.refetch()}>
              Retry
            </Button>
          }
        >
          {tenants.error.message}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Stat label="Stores" value={stats.stores} loading={tenants.isPending} />
        <Stat label="Active" value={stats.active} loading={tenants.isPending} />
        <Stat label="Disabled" value={stats.disabled} loading={tenants.isPending} />
        <Stat label="Aliases" value={stats.aliases} loading={tenants.isPending} />
      </Stack>

      <Paper>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2, alignItems: { sm: 'center' } }}>
          <TextField
            size="small"
            placeholder="Search host, URL or database"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ maxWidth: { sm: 360 } }}
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
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v: Filter | null) => v && setFilter(v)}>
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="disabled">Disabled</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <TableContainer>
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Host</TableCell>
                <TableCell>Database</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Added</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.isPending &&
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    {[0, 1, 2, 3, 4].map((j) => (
                      <TableCell key={j}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {rows.map((t) => (
                <TableRow key={t.host} hover sx={{ opacity: t.disabled ? 0.65 : 1 }}>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Tooltip title={t.connected ? 'Connection open on this API instance' : 'No open connection yet'}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            flexShrink: 0,
                            bgcolor: t.connected ? 'success.main' : 'action.disabled',
                          }}
                        />
                      </Tooltip>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.host}
                      </Typography>
                    </Stack>
                    <Link
                      href={t.frontendUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 2 }}
                    >
                      {t.frontendUrl}
                      <OpenInNew sx={{ fontSize: 12 }} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, wordBreak: 'break-all', maxWidth: 320 }}
                    >
                      {t.database}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <StatusChip tenant={t} tenants={all} />
                      {t.aliasOf && <Chip size="small" variant="outlined" label={`Alias of ${t.aliasOf}`} />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {t.createdAt ? dateFormat.format(new Date(t.createdAt)) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label={`Actions for ${t.host}`}
                      onClick={(e: MouseEvent<HTMLElement>) => setMenu({ anchor: e.currentTarget, tenant: t })}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {tenants.isSuccess && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', borderBottom: 0 }}>
                    <Typography color="text.secondary">
                      {all.length === 0 ? 'No stores yet. Add the first one.' : 'No stores match this search.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => openFromMenu('check')}>
          <ListItemIcon>
            <NetworkCheck fontSize="small" />
          </ListItemIcon>
          <ListItemText>Check connection</ListItemText>
        </MenuItem>
        {!menu?.tenant.aliasOf && (
          <MenuItem onClick={() => openFromMenu('seed')}>
            <ListItemIcon>
              <PersonAddAlt fontSize="small" />
            </ListItemIcon>
            <ListItemText>Seed admin users</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => openFromMenu('edit')}>
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openFromMenu('toggle')}>
          <ListItemIcon>
            {menu?.tenant.disabled ? <PlayCircleOutlined fontSize="small" /> : <PauseCircleOutlined fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{menu?.tenant.disabled ? 'Enable' : 'Disable'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openFromMenu('delete')} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteOutlined fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove</ListItemText>
        </MenuItem>
      </Menu>

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <TenantFormDialog
          tenant={dialog.kind === 'edit' ? dialog.tenant : undefined}
          tenants={all}
          onClose={closeDialog}
          onSaved={setToast}
        />
      )}
      {dialog?.kind === 'check' && <CheckDialog host={dialog.tenant.host} onClose={closeDialog} />}
      {dialog?.kind === 'seed' && <SeedDialog host={dialog.tenant.host} onClose={closeDialog} />}
      {dialog?.kind === 'toggle' && (
        <ConfirmDialog
          title={`${dialog.tenant.disabled ? 'Enable' : 'Disable'} ${dialog.tenant.host}?`}
          confirmLabel={dialog.tenant.disabled ? 'Enable' : 'Disable'}
          destructive={!dialog.tenant.disabled}
          pending={update.isPending}
          error={update.error}
          onClose={closeDialog}
          onConfirm={() =>
            update.mutate(
              { host: dialog.tenant.host, patch: { disabled: !dialog.tenant.disabled } },
              {
                onSuccess: () => {
                  setToast(`${dialog.tenant.host} ${dialog.tenant.disabled ? 'enabled' : 'disabled'}`);
                  closeDialog();
                },
              },
            )
          }
        >
          {dialog.tenant.disabled
            ? 'The store and its aliases will be served again.'
            : 'The API will answer 404 for this host and its aliases: the storefront and admin go offline. Its data is kept.'}
        </ConfirmDialog>
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Remove ${dialog.tenant.host}?`}
          confirmLabel="Remove"
          destructive
          typeToConfirm={dialog.tenant.host}
          pending={remove.isPending}
          error={remove.error}
          onClose={closeDialog}
          onConfirm={() =>
            remove.mutate(dialog.tenant.host, {
              onSuccess: () => {
                setToast(`${dialog.tenant.host} removed`);
                closeDialog();
              },
            })
          }
        >
          The host is unregistered and stops being served. Its database is <strong>not</strong> deleted; add the host
          again with the same connection string to bring it back.
        </ConfirmDialog>
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
