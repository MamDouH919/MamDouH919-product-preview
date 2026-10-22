import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { SeedUser } from '../api';
import { useSeedTenant } from '../hooks/useTenants';

const empty: SeedUser = { name: '', email: '', password: '' };

function UserFields({ label, value, onChange }: { label: string; value: SeedUser; onChange: (v: SeedUser) => void }) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{label}</Typography>
      <TextField label="Name" required value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      <TextField
        label="Email"
        type="email"
        required
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        helperText="At least 8 characters."
        slotProps={{ htmlInput: { minLength: 8 } }}
        value={value.password}
        onChange={(e) => onChange({ ...value, password: e.target.value })}
      />
    </Stack>
  );
}

export function SeedDialog({ host, onClose }: { host: string; onClose: () => void }) {
  const seed = useSeedTenant();
  const [admin, setAdmin] = useState<SeedUser>({ ...empty, name: 'Admin' });
  const [withSuper, setWithSuper] = useState(true);
  const [superAdmin, setSuperAdmin] = useState<SeedUser>({ ...empty, name: 'Super Admin' });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    seed.mutate({ host, admin, superAdmin: withSuper ? superAdmin : undefined });
  };

  if (seed.data) {
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{host} seeded</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {seed.data.log.map((line) => (
              <Alert key={line} severity={line.includes('already exists') ? 'info' : 'success'}>
                {line}
              </Alert>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" component="form" onSubmit={onSubmit}>
      <DialogTitle>Seed {host}</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <DialogContentText>
            Creates the admin and super admin roles with every permission, plus the users below. Users that already
            exist are left unchanged, so this is safe to run again.
          </DialogContentText>
          {seed.error && <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{seed.error.message}</Alert>}
          <UserFields label="Admin" value={admin} onChange={setAdmin} />
          <FormControlLabel
            control={<Switch checked={withSuper} onChange={(e) => setWithSuper(e.target.checked)} />}
            label="Also create a super admin (can change currency, timezone and import data)"
          />
          {withSuper && <UserFields label="Super admin" value={superAdmin} onChange={setSuperAdmin} />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" loading={seed.isPending}>
          Seed store
        </Button>
      </DialogActions>
    </Dialog>
  );
}
