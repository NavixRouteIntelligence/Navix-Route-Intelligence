'use client';

import type { AuthenticatedUser, LoginRequest } from '@navix/contracts';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { authApi } from '@/lib/api/auth';
import { setTokenBridge } from '@/lib/api/client';

const REFRESH_KEY = 'navix.refresh';

type Status = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: Status;
  user: AuthenticatedUser | null;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const accessToken = useRef<string | null>(null);
  const refreshToken = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    accessToken.current = null;
    refreshToken.current = null;
    if (typeof window !== 'undefined') window.localStorage.removeItem(REFRESH_KEY);
    setUser(null);
    setStatus('guest');
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    const token = refreshToken.current;
    if (!token) return null;
    try {
      const tokens = await authApi.refresh(token);
      accessToken.current = tokens.accessToken;
      refreshToken.current = tokens.refreshToken;
      if (typeof window !== 'undefined') window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      return null;
    }
  }, []);

  // Registra a ponte de token no cliente de API (injeção de dependência).
  useEffect(() => {
    setTokenBridge({
      getAccessToken: () => accessToken.current,
      refresh: doRefresh,
      onUnauthenticated: clearSession,
    });
    return () => setTokenBridge(null);
  }, [doRefresh, clearSession]);

  // Restaura sessão a partir do refresh token persistido.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_KEY) : null;
    if (!stored) {
      setStatus('guest');
      return;
    }
    refreshToken.current = stored;
    void (async () => {
      const token = await doRefresh();
      if (!token) {
        clearSession();
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me.data);
        setStatus('authenticated');
      } catch {
        clearSession();
      }
    })();
  }, [doRefresh, clearSession]);

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await authApi.login(payload);
    accessToken.current = result.tokens.accessToken;
    refreshToken.current = result.tokens.refreshToken;
    if (typeof window !== 'undefined') window.localStorage.setItem(REFRESH_KEY, result.tokens.refreshToken);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const token = refreshToken.current;
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // ignora — limpamos a sessão de qualquer forma
      }
    }
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
