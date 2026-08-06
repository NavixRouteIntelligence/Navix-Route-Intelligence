import type { CachePort } from '../../../../shared/cache/cache.port';
import type { RoutingProviderPort } from '../../domain/ports/routing-provider.port';
import { CachedRoutingProvider } from './cached-routing.provider';

describe('CachedRoutingProvider', () => {
  it('reutiliza a matriz para os mesmos geohashes, velocidade e provedor', async () => {
    const values = new Map<string, unknown>();
    const cache: CachePort = {
      get: async (key) => (values.get(key) as never) ?? null,
      set: async (key, value) => void values.set(key, value),
      del: async (key) => void values.delete(key),
      getOrSet: async <T>(key: string, _ttl: number, factory: () => Promise<T>) => {
        if (values.has(key)) return values.get(key) as T;
        const value = await factory();
        values.set(key, value);
        return value;
      },
    };
    const matrix = { distanceKm: [[0]], durationMin: [[0]] };
    const delegate: RoutingProviderPort = { matrix: jest.fn().mockResolvedValue(matrix) };
    const provider = new CachedRoutingProvider(cache, delegate, 'mapbox');
    const points = [{ latitude: 38.7223, longitude: -9.1393 }];

    await provider.matrix(points, 35);
    await provider.matrix(points, 35);

    expect(delegate.matrix).toHaveBeenCalledTimes(1);
  });

  it('não mistura velocidades diferentes', async () => {
    const cache = {
      getOrSet: (_k: string, _t: number, f: () => Promise<unknown>) => f(),
    } as CachePort;
    const delegate: RoutingProviderPort = {
      matrix: jest.fn().mockResolvedValue({ distanceKm: [], durationMin: [] }),
    };
    const provider = new CachedRoutingProvider(cache, delegate, 'haversine');
    await provider.matrix([], 30);
    await provider.matrix([], 40);
    expect(delegate.matrix).toHaveBeenCalledTimes(2);
  });
});

// NAV-4.7 / ADR-0106: o cache é serializado como JSON, e
// `JSON.stringify(Infinity)` é `null`. Sem codificação explícita, a segunda
// leitura devolveria `null` e a aritmética viraria NaN — pior que o defeito
// original, e só na chamada com cache quente.
describe('CachedRoutingProvider — trechos proibidos sobrevivem ao JSON', () => {
  function cacheComJson() {
    const values = new Map<string, string>();
    const cache: CachePort = {
      get: async (key) => (values.has(key) ? (JSON.parse(values.get(key)!) as never) : null),
      set: async (key, value) => void values.set(key, JSON.stringify(value)),
      del: async (key) => void values.delete(key),
      getOrSet: async <T>(key: string, _ttl: number, factory: () => Promise<T>) => {
        if (values.has(key)) return JSON.parse(values.get(key)!) as T;
        const value = await factory();
        values.set(key, JSON.stringify(value));
        return value;
      },
    };
    return cache;
  }

  it('devolve infinito também na leitura com cache quente', async () => {
    const matrix = {
      distanceKm: [
        [0, Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY, 0],
      ],
      durationMin: [
        [0, Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY, 0],
      ],
    };
    const delegate: RoutingProviderPort = { matrix: jest.fn().mockResolvedValue(matrix) };
    const provider = new CachedRoutingProvider(cacheComJson(), delegate, 'mapbox');
    const points = [
      { latitude: 38.7223, longitude: -9.1393 },
      { latitude: 38.7323, longitude: -9.1493 },
    ];

    const primeira = await provider.matrix(points, 35);
    const segunda = await provider.matrix(points, 35);

    expect(delegate.matrix).toHaveBeenCalledTimes(1);
    expect(primeira.durationMin[0][1]).toBe(Number.POSITIVE_INFINITY);
    // A que importa: veio do cache, e continua proibida.
    expect(segunda.durationMin[0][1]).toBe(Number.POSITIVE_INFINITY);
    expect(segunda.distanceKm[0][1]).toBe(Number.POSITIVE_INFINITY);
    expect(segunda.distanceKm[0][0]).toBe(0);
  });
});

// NAV-4.9 / ADR-0108: sem o perfil na chave, uma rota de bicicleta
// reaproveitaria a matriz de carro dos mesmos pontos — silenciosamente, e só
// com o cache quente, que é o pior momento para descobrir.
describe('CachedRoutingProvider — o perfil separa as matrizes', () => {
  function cacheEmMemoria() {
    const values = new Map<string, unknown>();
    const cache: CachePort = {
      get: async (key) => (values.get(key) as never) ?? null,
      set: async (key, value) => void values.set(key, value),
      del: async (key) => void values.delete(key),
      getOrSet: async <T>(key: string, _ttl: number, factory: () => Promise<T>) => {
        if (values.has(key)) return values.get(key) as T;
        const value = await factory();
        values.set(key, value);
        return value;
      },
    };
    return cache;
  }

  const pontos = [
    { latitude: 38.7223, longitude: -9.1393 },
    { latitude: 38.7323, longitude: -9.1493 },
  ];

  it('carro e bicicleta nos mesmos pontos não compartilham matriz', async () => {
    const matrix = {
      distanceKm: [
        [0, 1],
        [1, 0],
      ],
      durationMin: [
        [0, 2],
        [2, 0],
      ],
      source: 'provider' as const,
    };
    const delegate: RoutingProviderPort = { matrix: jest.fn().mockResolvedValue(matrix) };
    const provider = new CachedRoutingProvider(cacheEmMemoria(), delegate, 'mapbox');

    await provider.matrix(pontos, 40, 'car');
    await provider.matrix(pontos, 15, 'bicycle');

    expect(delegate.matrix).toHaveBeenCalledTimes(2);
    // E o tipo chega ao provedor, não fica só na chave.
    expect((delegate.matrix as jest.Mock).mock.calls[1][2]).toBe('bicycle');
  });

  it('tipos que mapeiam para o mesmo perfil compartilham a matriz', async () => {
    const matrix = {
      distanceKm: [
        [0, 1],
        [1, 0],
      ],
      durationMin: [
        [0, 2],
        [2, 0],
      ],
      source: 'provider' as const,
    };
    const delegate: RoutingProviderPort = { matrix: jest.fn().mockResolvedValue(matrix) };
    const provider = new CachedRoutingProvider(cacheEmMemoria(), delegate, 'mapbox');

    // `van` e `car` pedem `driving`: a matriz é literalmente a mesma, e separar
    // gastaria requisição à toa.
    await provider.matrix(pontos, 40, 'car');
    await provider.matrix(pontos, 40, 'van');

    expect(delegate.matrix).toHaveBeenCalledTimes(1);
  });
});
