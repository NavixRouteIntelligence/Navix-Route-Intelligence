import type {
  ApiErrorResponse,
  LoginRequest,
  LoginResponse,
} from '@navix/contracts';

/**
 * Cliente HTTP mínimo para a API Navix. Usa os contratos compartilhados
 * (@navix/contracts) para garantir alinhamento com o backend.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  const response = await fetch(`${BASE_URL}/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    let message = 'Erro inesperado.';
    try {
      const body = (await response.json()) as ApiErrorResponse;
      message = body.error?.message ?? message;
    } catch {
      // resposta sem corpo JSON — mantém mensagem padrão
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
}

export const authApi = {
  login(payload: LoginRequest): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
