import { useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { PLAN_LABELS, type StorePlan, type Tenant } from '../api';
import { useCreateTenant, useUpdateTenant } from '../hooks/useTenants';

interface Props {
  /** The store being edited; left out to add a new one. */
  tenant?: Tenant;
  tenants: Tenant[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

const PLAN_HINTS: Record<StorePlan, string> = {
  full: 'Online orders, customer accounts, stock and accounting.',
  catalog: 'Products and the website only. Visitors ask on WhatsApp; nothing is ordered online.',
};

export function TenantFormDialog({ tenant, tenants, onClose, onSaved }: Props) {
  const editing = Boolean(tenant);
  const [host, setHost] = useState(tenant?.host ?? '');
  const [frontendUrl, setFrontendUrl] = useState(tenant?.frontendUrl ?? '');
  const [urlTouched, setUrlTouched] = useState(editing);
  const [mongoUri, setMongoUri] = useState('');
  const [aliasOf, setAliasOf] = useState(tenant?.aliasOf ?? '');
  const [plan, setPlan] = useState<StorePlan>(tenant?.plan ?? 'full');
  const create = useCreateTenant();
  const update = useUpdateTenant();
  const mutation = editing ? update : create;

  // An alias must point at a primary store, never at another alias or itself.
  const primaries = tenants.filter((t) => !t.aliasOf && t.host !== tenant?.host);

  const onHostChange = (value: string) => {
    const clean = value.trim().toLowerCase();
    setHost(clean);
    // The API usually sits on api.<store domain>; suggest the store domain itself.
    if (!urlTouched) setFrontendUrl(clean ? `https://${clean.replace(/^api[.-](?=.+\.)/, '')}` : '');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tenant) {
      await update.mutateAsync({
        host: tenant.host,
        patch: {
          frontendUrl,
          aliasOf: aliasOf || null,
          ...(aliasOf ? {} : { plan }),
          ...(mongoUri.trim() ? { mongoUri: mongoUri.trim() } : {}),
        },
      });
      onSaved(`${tenant.host} updated`);
    } else {
      await create.mutateAsync({ host, frontendUrl, mongoUri: mongoUri.trim(), ...(aliasOf ? { aliasOf } : { plan }) });
      onSaved(`${host} added`);
    }
    onClose();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" component="form" onSubmit={(e) => void onSubmit(e).catch(() => {})}>
      <DialogTitle>{editing ? `Edit ${tenant!.host}` : 'Add store'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {mutation.error && <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{mutation.error.message}</Alert>}
          <TextField
            label="API hostname"
            placeholder="api.shop.example.com"
            helperText="The host the store's frontend calls the API on. No scheme or port."
            required
            disabled={editing}
            autoFocus={!editing}
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
          />
          <TextField
            label="Frontend URL"
            placeholder="https://shop.example.com"
            helperText="Allowed by CORS and used in email links."
            required
            type="url"
            value={frontendUrl}
            onChange={(e) => {
              setUrlTouched(true);
              setFrontendUrl(e.target.value);
            }}
          />
          <TextField
            label="MongoDB connection string"
            placeholder={editing ? 'Leave blank to keep the current one' : 'mongodb+srv://user:pass@cluster/shop-db'}
            helperText={editing ? `Current: ${tenant!.database}` : 'Each store needs its own database. Stored encrypted.'}
            required={!editing}
            autoComplete="off"
            slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'ui-monospace, monospace' } } }}
            value={mongoUri}
            onChange={(e) => setMongoUri(e.target.value)}
          />
          <TextField
            select
            label="Alias of"
            helperText="For a second name of an existing store (e.g. www.). Must use the same database."
            value={aliasOf}
            onChange={(e) => setAliasOf(e.target.value)}
          >
            <MenuItem value="">
              <em>None — this is its own store</em>
            </MenuItem>
            {primaries.map((t) => (
              <MenuItem key={t.host} value={t.host}>
                {t.host}
              </MenuItem>
            ))}
          </TextField>
          {!aliasOf && (
            <TextField
              select
              label="Plan"
              helperText={PLAN_HINTS[plan]}
              value={plan}
              onChange={(e) => setPlan(e.target.value as StorePlan)}
            >
              {(Object.keys(PLAN_LABELS) as StorePlan[]).map((p) => (
                <MenuItem key={p} value={p}>
                  {PLAN_LABELS[p]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {editing && !aliasOf && plan !== tenant!.plan && (
            <Alert severity="info">
              {plan === 'catalog'
                ? 'Orders, stock and accounting are hidden from the store, not deleted. Switching back brings them back as they were.'
                : 'The store gets online orders, stock and accounting, with any data it had before.'}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" loading={mutation.isPending}>
          {editing ? 'Save changes' : 'Add store'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
