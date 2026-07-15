import type { AppConfigService } from '../../../../shared/config/app-config.service';
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
});
