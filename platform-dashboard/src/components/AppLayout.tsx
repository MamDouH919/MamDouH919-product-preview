import { AppBar, Box, Container, IconButton, Toolbar, Tooltip, Typography, useColorScheme } from '@mui/material';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import Logout from '@mui/icons-material/Logout';
import Hub from '@mui/icons-material/Hub';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../hooks/useTenants';

function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const current = mode === 'system' ? systemMode : mode;
  if (!current) return null;
  const next = current === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <IconButton onClick={() => setMode(next)} color="inherit">
        {current === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
      </IconButton>
    </Tooltip>
  );
}

export function AppLayout() {
  const { isAuthenticated, logout } = useAuth();
  const me = useMe();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Hub color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Platform
          </Typography>
          {me.data && (
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {me.data.email}
            </Typography>
          )}
          <ColorModeToggle />
          <Tooltip title="Sign out">
            <IconButton onClick={logout} color="inherit">
              <Logout />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
