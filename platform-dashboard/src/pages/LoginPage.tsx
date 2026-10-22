import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import Hub from '@mui/icons-material/Hub';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/tenants" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/tenants', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper component="form" onSubmit={onSubmit} sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Hub color="primary" fontSize="large" />
            <Box>
              <Typography variant="h5">Platform</Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to manage stores
              </Typography>
            </Box>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" size="large" loading={submitting}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
