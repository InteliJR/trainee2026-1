import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type Collector } from './index';

interface AuthState {
  collector: Collector | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Sessão do coletor logado (RF02 / RNF05): restaura ao abrir e alimenta o guard de rotas e o cabeçalho.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [collector, setCollector] = useState<Collector | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((c) => active && setCollector(c))
      .catch(() => active && setCollector(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setCollector(await authApi.login(email, password));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setCollector(null);
    }
  }, []);

  const value = useMemo(() => ({ collector, loading, login, logout }), [collector, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
