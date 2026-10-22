import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import { AuthContext } from './hooks/useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState(getToken);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await api.login(email, password);
    setToken(accessToken);
    setTokenState(accessToken);
  }, []);

  const value = useMemo(() => ({ isAuthenticated: Boolean(token), login, logout }), [token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
