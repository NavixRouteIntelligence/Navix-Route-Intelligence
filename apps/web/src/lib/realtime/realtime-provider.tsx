'use client';

import type { RealtimeEvent, RealtimeEventType } from '@navix/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { realtimeApi } from '@/lib/api/realtime';
import { useAuth } from '@/lib/auth/auth-provider';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
const MAX_BACKOFF_MS = 15_000;

type Handler = (data: unknown) => void;

interface RealtimeContextValue {
  /** Verdadeiro quando o stream SSE está conectado (senão, use polling). */
  connected: boolean;
  subscribe: (type: RealtimeEventType, handler: Handler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Conexão SSE única do app (ADR-0018): obtém um ticket, abre o `EventSource`,
 * reconecta com backoff (buscando um ticket novo a cada tentativa) e distribui os
 * eventos aos assinantes por tipo. Só conecta quando autenticado. O `connected`
 * permite aos consumidores manter o **polling apenas como fallback**.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [connected, setConnected] = useState(false);
  const handlers = useRef<Map<RealtimeEventType, Set<Handler>>>(new Map());

  const dispatch = useCallback((event: RealtimeEvent) => {
    if (event.type === 'ping') return;
    handlers.current.get(event.type)?.forEach((h) => h(event.data));
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      timer = setTimeout(connect, delay);
    };

    async function connect() {
      if (cancelled) return;
      try {
        const { ticket } = await realtimeApi.ticket();
        if (cancelled) return;
        const es = new EventSource(
          `${BASE_URL}/v1/realtime/stream?ticket=${encodeURIComponent(ticket)}`,
        );
        source = es;
        es.onopen = () => {
          attempt = 0;
          setConnected(true);
        };
        es.onmessage = (e) => {
          try {
            dispatch(JSON.parse(e.data) as RealtimeEvent);
          } catch {
            /* ignora frames malformados */
          }
        };
        es.onerror = () => {
          es.close();
          source = null;
          setConnected(false);
          scheduleReconnect();
        };
      } catch {
        setConnected(false);
        scheduleReconnect();
      }
    }

    void connect();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      source?.close();
      setConnected(false);
    };
  }, [status, dispatch]);

  const subscribe = useCallback((type: RealtimeEventType, handler: Handler) => {
    let set = handlers.current.get(type);
    if (!set) {
      set = new Set();
      handlers.current.set(type, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ connected, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime deve ser usado dentro de <RealtimeProvider>.');
  return ctx;
}

/** Assina um tipo de evento em tempo real; re-inscreve se o handler mudar. */
export function useRealtimeEvent<T extends RealtimeEventType>(
  type: T,
  handler: (data: Extract<RealtimeEvent, { type: T }>['data']) => void,
): void {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  // `as never` evita a colapsagem do genérico ao repassar o dado não-tipado do hub.
  useEffect(() => subscribe(type, (data) => ref.current(data as never)), [subscribe, type]);
}
