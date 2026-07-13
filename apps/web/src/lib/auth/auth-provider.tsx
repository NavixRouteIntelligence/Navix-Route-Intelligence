'use client';

import type { AuthenticatedUser, LoginRequest, RegisterRequest } from '@navix/contracts';
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

type Status = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: Status;
  user: AuthenticatedUser | null;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Autenticação padrão de produção:
 *  - **Access token** apenas em memória (`useRef`) — nunca em localStorage.
 *  - **Refresh token** em **cookie HttpOnly** gerido pelo backend — inacessível
 *    ao JavaScript. O cliente nunca lê nem guarda o refresh token.
 *  - A sessão é restaurada no boot chamando `/auth/refresh` (o cookie, se
 *    existir, autentica a rotação e devolve um novo access token).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const accessToken = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    accessToken.current = null;
    setUser(null);
    setStatus('guest');
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    try {
      // Sem argumento: o refresh token vai no cookie HttpOnly (credentials:include).
      const tokens = await authApi.refresh();
      accessToken.current = tokens.accessToken;
      return tokens.accessToken;
    } catch {
      accessToken.current = null;
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

  // Restaura a sessão a partir do cookie HttpOnly de refresh (se houver).
  useEffect(() => {
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

  const applySession = useCallback(
    (result: { user: AuthenticatedUser; tokens: { accessToken: string } }) => {
      accessToken.current = result.tokens.accessToken;
      setUser(result.user);
      setStatus('authenticated');
    },
    [],
  );

  const login = useCallback(
    async (payload: LoginRequest) => {
      const result = await authApi.login(payload);
      applySession(result);
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<AuthenticatedUser> => {
      const result = await authApi.register(payload);
      applySession(result);
      return result.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      // Revoga o refresh token (via cookie) e limpa o cookie no servidor.
      await authApi.logout();
    } catch {
      // ignora — limpamos a sessão de qualquer forma
    }
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
