import type { PublicTrackingView, ResourceResponse } from '@navix/contracts';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

/** Distingue "link inválido" de "falha ao carregar" para a UI. */
export class TrackingNotFoundError extends Error {}

/**
 * Consulta o rastreamento público (ADR-0082).
 *
 * Não usa o `client.ts`: aquele carrega a ponte de token e o fluxo de refresh,
 * e esta página é **anônima por natureza** — o destinatário não tem conta.
 * Chamar `fetch` direto mantém a página sem qualquer dependência de sessão.
 */
export async function fetchPublicTracking(token: string): Promise<PublicTrackingView> {
  const res = await fetch(`${BASE_URL}/v1/public/tracking/${encodeURIComponent(token)}`, {
    // Sem cache: status e posição mudam durante a entrega.
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) throw new TrackingNotFoundError('not found');
  if (!res.ok) throw new Error(`tracking request failed: ${res.status}`);

  const body = (await res.json()) as ResourceResponse<PublicTrackingView>;
  return body.data;
}
