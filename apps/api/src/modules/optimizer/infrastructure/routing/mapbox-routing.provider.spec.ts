import type { AppConfigService } from '../../../../shared/config/app-config.service';
import { UNREACHABLE } from '../../domain/reachability';
import { MapboxRoutingProvider } from './mapbox-routing.provider';

const points = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0.1 },
];

function configWith(mapboxToken?: string): AppConfigService {
  return { maps: { provider: 'mapbox', mapboxToken } } as AppConfigService;
}

describe('MapboxRoutingProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sem token: cai no Haversine', async () => {
    const m = await new MapboxRoutingProvider(configWith(undefined)).matrix(points, 60);
    expect(m.distanceKm[0][1]).toBeGreaterThan(0);
  });

  it('com token: converte a resposta do Mapbox (m→km, s→min)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [
          [0, 11120],
          [11120, 0],
        ],
        durations: [
          [0, 600],
          [600, 0],
        ],
      }),
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(points, 60);
    expect(m.distanceKm[0][1]).toBeCloseTo(11.12, 2); // 11120 m
    expect(m.durationMin[0][1]).toBe(10); // 600 s
  });

  it('falha da API: degrada para Haversine (resiliente)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(points, 60);
    expect(m.distanceKm[0][1]).toBeGreaterThan(0); // haversine, não quebrou
  });

  // NAV-4.7 / ADR-0106: `null` na matriz significa **não existe rota**. Virava
  // zero minutos — a aresta mais barata do grafo, logo a preferida — e a
  // distância caía em Haversine, fingindo estrada sobre rio, mar ou muro.
  it('par sem rota vira proibição, não custo zero', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [
          [0, null],
          [null, 0],
        ],
        durations: [
          [0, null],
          [null, 0],
        ],
      }),
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(points, 60);

    expect(m.durationMin[0][1]).toBe(UNREACHABLE);
    expect(m.durationMin[0][1]).not.toBe(0);
    expect(m.distanceKm[0][1]).toBe(UNREACHABLE);
    // A diagonal segue zero: ficar parado é possível e não custa nada.
    expect(m.distanceKm[0][0]).toBe(0);
  });

  // `NoRoute` não é falha do provedor: é ele afirmando que não há caminho.
  // Degradar aqui devolveria linha reta sobre o oceano.
  it('code NoRoute proíbe todos os pares, sem cair no Haversine', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'NoRoute' }),
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(points, 60);

    expect(m.distanceKm[0][1]).toBe(UNREACHABLE);
    expect(m.durationMin[0][1]).toBe(UNREACHABLE);
  });

  // Resposta incompleta é falha do provedor, não ausência de rota: a
  // degradação para Haversine (ADR-0027) continua valendo.
  it('resposta sem durations degrada para Haversine, com valores finitos', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [
          [0, 11120],
          [11120, 0],
        ],
      }),
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(points, 60);

    expect(Number.isFinite(m.distanceKm[0][1])).toBe(true);
    expect(m.distanceKm[0][1]).toBeGreaterThan(0);
    expect(Number.isFinite(m.durationMin[0][1])).toBe(true);
  });

  it('outros códigos de erro seguem degradando', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ProfileNotFound' }),
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(points, 60);

    expect(Number.isFinite(m.distanceKm[0][1])).toBe(true);
  });
});
