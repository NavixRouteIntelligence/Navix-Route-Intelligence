import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  acceptDriverInvite,
  fetchDriverInvite,
  InviteAcceptError,
  InviteNotFoundError,
} from './driver-invite';

const PREVIEW = {
  email: 'maria@exemplo.pt',
  organizationName: 'Transportes Aurora',
  requiresDriverDetails: false,
};

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDriverInvite', () => {
  it('resolve o convite sem enviar credenciais (página anônima)', async () => {
    const fetchMock = mockFetch(200, { data: PREVIEW });

    await expect(fetchDriverInvite('tok-123')).resolves.toEqual(PREVIEW);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/public/driver-invites/tok-123');
    // Nenhum Authorization: quem abre esta página ainda não tem conta.
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.cache).toBe('no-store');
  });

  it('escapa o token na URL (não injeta caminho)', async () => {
    const fetchMock = mockFetch(200, { data: PREVIEW });

    await fetchDriverInvite('../admin');

    expect(String(fetchMock.mock.calls[0][0])).toContain('%2F');
  });

  // A UI distingue "convite inválido" (definitivo) de "falha ao carregar"
  // (transitória) para não pedir retry do que nunca vai funcionar.
  it('404 vira InviteNotFoundError', async () => {
    mockFetch(404);
    await expect(fetchDriverInvite('tok-123')).rejects.toBeInstanceOf(InviteNotFoundError);
  });

  it('erro de servidor permite retry', async () => {
    mockFetch(500);
    const err = await fetchDriverInvite('tok-123').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(InviteNotFoundError);
  });
});

describe('acceptDriverInvite', () => {
  // O corpo não tem e-mail nem organização — ambos vêm do token (ADR-0085).
  it('envia apenas o que o convidado escolheu', async () => {
    const fetchMock = mockFetch(201, {
      data: { email: 'maria@exemplo.pt', organizationName: 'Transportes Aurora' },
    });

    await acceptDriverInvite('tok-123', { password: 'senha-forte-123' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/public/driver-invites/tok-123/accept');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ password: 'senha-forte-123' });
  });

  it('repassa nome e CNH quando o convite não tem ficha', async () => {
    const fetchMock = mockFetch(201, {
      data: { email: 'joao@exemplo.pt', organizationName: 'Transportes Aurora' },
    });

    await acceptDriverInvite('tok-123', {
      password: 'senha-forte-123',
      name: 'João Aguiar',
      licenseNumber: 'CNH-42',
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      name: 'João Aguiar',
      licenseNumber: 'CNH-42',
    });
  });

  // Convite consumido entre abrir a página e enviar o formulário.
  it('404 no aceite vira InviteNotFoundError', async () => {
    mockFetch(404);
    await expect(
      acceptDriverInvite('tok-123', { password: 'senha-forte-123' }),
    ).rejects.toBeInstanceOf(InviteNotFoundError);
  });

  // 409 (e-mail já cadastrado) e 400 (falta CNH) trazem mensagem útil da API:
  // mostrar a nossa por cima esconderia o motivo real.
  it('erro de negócio preserva a mensagem da API', async () => {
    mockFetch(409, { error: { message: 'E-mail já cadastrado.' } });

    const err = await acceptDriverInvite('tok-123', { password: 'x'.repeat(8) }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(InviteAcceptError);
    expect((err as Error).message).toBe('E-mail já cadastrado.');
  });
});
