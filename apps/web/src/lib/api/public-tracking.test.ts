import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicTracking, TrackingNotFoundError } from './public-tracking';

const VIEW = {
  status: 'in_route',
  estimatedArrival: '2026-07-24T11:30:00.000Z',
  etaIsEstimate: true,
  vehiclePosition: { latitude: 38.7, longitude: -9.1, recordedAt: '2026-07-24T10:00:00.000Z' },
  destination: { latitude: 38.72, longitude: -9.14 },
  updatedAt: '2026-07-24T10:00:05.000Z',
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

describe('fetchPublicTracking', () => {
  it('busca o rastreamento sem enviar credenciais (página anônima)', async () => {
    const fetchMock = mockFetch(200, { data: VIEW });

    await expect(fetchPublicTracking('tok-123')).resolves.toEqual(VIEW);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/public/tracking/tok-123');
    // Nenhum Authorization: a página não tem sessão para vazar.
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.cache).toBe('no-store');
  });

  it('escapa o token na URL (não injeta caminho)', async () => {
    const fetchMock = mockFetch(200, { data: VIEW });

    await fetchPublicTracking('../admin');

    expect(String(fetchMock.mock.calls[0][0])).toContain('%2F');
  });

  // A UI distingue "link inválido" (definitivo) de "falha ao carregar"
  // (transitória) para não pedir retry do que nunca vai funcionar.
  it('404 vira TrackingNotFoundError', async () => {
    mockFetch(404);
    await expect(fetchPublicTracking('tok-123')).rejects.toBeInstanceOf(TrackingNotFoundError);
  });

  it('erro de servidor vira erro genérico (permite retry)', async () => {
    mockFetch(500);
    const err = await fetchPublicTracking('tok-123').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TrackingNotFoundError);
  });
});
