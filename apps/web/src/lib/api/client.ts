import type { ApiErrorResponse } from '@navix/contracts';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Provedor de token de acesso + callback de refresh, injetados pelo AuthProvider. */
export interface TokenBridge {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  onUnauthenticated: () => void;
}

let bridge: TokenBridge | null = null;
export function setTokenBridge(b: TokenBridge | null): void {
  bridge = b;
}

/** Monta query string ignorando valores vazios/indefinidos. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  /** Interno: evita loop de refresh. */
  _retry?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return new ApiError(body.error?.message ?? 'Erro inesperado.', response.status, body.error?.code);
  } catch {
    return new ApiError('Erro inesperado.', response.status);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth && bridge) {
    const token = bridge.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 401 → tenta refresh uma vez, depois repete.
  if (response.status === 401 && auth && bridge && !options._retry) {
    const newToken = await bridge.refresh();
    if (newToken) {
      return apiRequest<T>(path, { ...options, _retry: true });
    }
    bridge.onUnauthenticated();
    throw await parseError(response);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Envio multipart (upload de arquivo). Não define Content-Type — o browser
 * monta o boundary. Reaproveita o bridge de token e o refresh em 401.
 */
export async function apiUpload<T>(path: string, form: FormData, _retry = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (bridge) {
    const token = bridge.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}/v1${path}`, { method: 'POST', headers, body: form });

  if (response.status === 401 && bridge && !_retry) {
    const newToken = await bridge.refresh();
    if (newToken) return apiUpload<T>(path, form, true);
    bridge.onUnauthenticated();
    throw await parseError(response);
  }

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}
