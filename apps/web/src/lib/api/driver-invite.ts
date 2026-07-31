import type {
  AcceptDriverInviteRequest,
  AcceptDriverInviteResponse,
  DriverInvitePreview,
  ResourceResponse,
} from '@navix/contracts';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

/** Distingue "convite inválido/expirado" de "falha ao carregar" para a UI. */
export class InviteNotFoundError extends Error {}

/** Erro de negócio do aceite (ex.: e-mail já cadastrado, CNH duplicada). */
export class InviteAcceptError extends Error {}

/**
 * Cliente do convite de motorista (ADR-0085).
 *
 * Não usa o `client.ts`, pelo mesmo motivo do rastreio público: aquele carrega
 * a ponte de token e o fluxo de refresh, e esta página é **anônima por
 * natureza** — o convidado ainda não tem conta. É justamente a conta que ele
 * vem criar.
 */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? '';
  } catch {
    return '';
  }
}

export async function fetchDriverInvite(token: string): Promise<DriverInvitePreview> {
  const res = await fetch(`${BASE_URL}/v1/public/driver-invites/${encodeURIComponent(token)}`, {
    // Sem cache: o convite pode ter sido aceito ou revogado a qualquer momento.
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) throw new InviteNotFoundError('not found');
  if (!res.ok) throw new Error(`invite request failed: ${res.status}`);

  const body = (await res.json()) as ResourceResponse<DriverInvitePreview>;
  return body.data;
}

export async function acceptDriverInvite(
  token: string,
  payload: AcceptDriverInviteRequest,
): Promise<AcceptDriverInviteResponse> {
  const res = await fetch(
    `${BASE_URL}/v1/public/driver-invites/${encodeURIComponent(token)}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  // 404 aqui significa que o convite deixou de valer entre abrir a página e
  // enviar o formulário (expirou, foi revogado ou já foi aceito).
  if (res.status === 404) throw new InviteNotFoundError('not found');
  if (!res.ok) throw new InviteAcceptError((await readError(res)) || 'accept failed');

  const body = (await res.json()) as ResourceResponse<AcceptDriverInviteResponse>;
  return body.data;
}
