import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { LANGUAGE_LABELS, PLAN_LABELS, type StoreLanguage, type StorePlan, type Tenant } from '../api';
import { useCreateTenant, useUpdateTenant } from '../hooks/useTenants';

interface Props {
  /** The store being edited; left out to add a new one. */
  tenant?: Tenant;
  tenants: Tenant[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** What each plan has beyond the website, for telling an admin what a switch shows or hides. */
const PLAN_PARTS: Record<StorePlan, string[]> = {
  catalog: [],
  orders: ['online orders'],
  full: ['online orders', 'stock', 'accounting'],
};

const list = (parts: string[]) =>
  parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** What switching from one plan to another does to the store's data. */
function switchNote(from: StorePlan, to: StorePlan): string {
  const hidden = PLAN_PARTS[from].filter((p) => !PLAN_PARTS[to].includes(p));
  const added = PLAN_PARTS[to].filter((p) => !PLAN_PARTS[from].includes(p));
  const notes: string[] = [];
  if (hidden.length) {
    const what = list(hidden);
    notes.push(`${what[0].toUpperCase()}${what.slice(1)} are hidden from the store, not deleted. Switching back brings them back as they were.`);
  }
  if (added.length) notes.push(`The store gets ${list(added)}, with any data it had before.`);
  return notes.join(' ');
}

const PLAN_HINTS: Record<StorePlan, string> = {
  full: 'Online orders, customer accounts, stock and accounting.',
  orders: 'Online orders, customer accounts, coupons and returns. No stock, purchases, couriers or accounting — and it can never be moved to the full shop.',
  catalog: 'Products and the website only. Visitors ask on WhatsApp; nothing is ordered online.',
};

const ALL_LANGUAGES = Object.keys(LANGUAGE_LABELS) as StoreLanguage[];
/** What a store is published in when nobody has said otherwise — the API's defaults. */
const DEFAULT_LANGUAGES: StoreLanguage[] = ['en', 'ar'];
const DEFAULT_LANGUAGE: StoreLanguage = 'ar';

const names = (langs: StoreLanguage[]) => list(langs.map((l) => LANGUAGE_LABELS[l].replace(/ \(.*\)$/, '')));

/** What a change of languages does to the live site and its place in search results. */
function languageNotes(tenant: Tenant, languages: StoreLanguage[], defaultLanguage: StoreLanguage): string[] {
  const notes: string[] = [];
  const removed = tenant.languages.filter((l) => !languages.includes(l));
  const added = languages.filter((l) => !tenant.languages.includes(l));
  if (removed.length) {
    notes.push(
      `Pages in ${names(removed)} will redirect permanently (301) to the same page in ${names([defaultLanguage])}, ` +
        'so their links and search ranking carry over. Turning a language back on later starts its pages in search from scratch.',
    );
  }
  if (added.length) {
    notes.push(
      `The site gets ${names(added)} pages. Fill in their texts in the store's dashboard first: ` +
        'pages with missing translations hurt how search engines rate the whole site.',
    );
  }
  if (defaultLanguage !== tenant.defaultLanguage) {
    notes.push(`The home page will open in ${names([defaultLanguage])}, and search engines will treat it as the main version.`);
  }
  return notes;
}

export function TenantFormDialog({ tenant, tenants, onClose, onSaved }: Props) {
  const editing = Boolean(tenant);
  const [host, setHost] = useState(tenant?.host ?? '');
  const [frontendUrl, setFrontendUrl] = useState(tenant?.frontendUrl ?? '');
  const [urlTouched, setUrlTouched] = useState(editing);
  const [mongoUri, setMongoUri] = useState('');
  const [aliasOf, setAliasOf] = useState(tenant?.aliasOf ?? '');
  const [plan, setPlan] = useState<StorePlan>(tenant?.plan ?? 'full');
  const [languages, setLanguages] = useState<StoreLanguage[]>(tenant?.languages ?? DEFAULT_LANGUAGES);
  const [defaultLanguage, setDefaultLanguage] = useState<StoreLanguage>(tenant?.defaultLanguage ?? DEFAULT_LANGUAGE);
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

  const toggleLanguage = (lang: StoreLanguage, on: boolean) => {
    const next = ALL_LANGUAGES.filter((l) => (l === lang ? on : languages.includes(l)));
    if (!next.length) return; // A store is always published in at least one language.
    setLanguages(next);
    if (!next.includes(defaultLanguage)) setDefaultLanguage(next[0]);
  };

  // The default first: the order the storefront lists them in.
  const languageFields = { languages: [defaultLanguage, ...languages.filter((l) => l !== defaultLanguage)], defaultLanguage };
  const notes = editing && !aliasOf && !tenant!.aliasOf ? languageNotes(tenant!, languages, defaultLanguage) : [];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tenant) {
      await update.mutateAsync({
        host: tenant.host,
        patch: {
          frontendUrl,
          aliasOf: aliasOf || null,
          ...(aliasOf ? {} : { plan, ...languageFields }),
          ...(mongoUri.trim() ? { mongoUri: mongoUri.trim() } : {}),
        },
      });
      onSaved(`${tenant.host} updated`);
    } else {
      await create.mutateAsync({ host, frontendUrl, mongoUri: mongoUri.trim(), ...(aliasOf ? { aliasOf } : { plan, ...languageFields }) });
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
              {/* An orders-only store never moves to the full shop: it has no books to start from. */}
              {(Object.keys(PLAN_LABELS) as StorePlan[])
                .filter((p) => !(tenant?.plan === 'orders' && p === 'full'))
                .map((p) => (
                <MenuItem key={p} value={p}>
                  {PLAN_LABELS[p]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {editing && !aliasOf && plan !== tenant!.plan && (
            <Alert severity="info">
              {switchNote(tenant!.plan, plan)}
            </Alert>
          )}
          {!aliasOf && (
            <FormControl component="fieldset">
              <FormLabel component="legend">Website languages</FormLabel>
              <FormGroup row>
                {ALL_LANGUAGES.map((l) => (
                  <FormControlLabel
                    key={l}
                    label={LANGUAGE_LABELS[l]}
                    control={
                      <Checkbox
                        checked={languages.includes(l)}
                        disabled={languages.length === 1 && languages.includes(l)}
                        onChange={(e) => toggleLanguage(l, e.target.checked)}
                      />
                    }
                  />
                ))}
              </FormGroup>
              <FormHelperText>
                {languages.length === 1
                  ? `The site is published in ${names(languages)} only: no language switcher, and the store's dashboard asks for ${names(languages)} texts only.`
                  : 'Each page is published in every language, linked for search engines with hreflang.'}
              </FormHelperText>
            </FormControl>
          )}
          {!aliasOf && (
            <TextField
              select
              label="Default language"
              helperText={'Where the home page "/" opens, and the version search engines show by default.'}
              value={defaultLanguage}
              disabled={languages.length === 1}
              onChange={(e) => setDefaultLanguage(e.target.value as StoreLanguage)}
            >
              {languages.map((l) => (
                <MenuItem key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {notes.length > 0 && (
            <Alert severity="warning">
              {notes.map((n) => (
                <div key={n}>{n}</div>
              ))}
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
