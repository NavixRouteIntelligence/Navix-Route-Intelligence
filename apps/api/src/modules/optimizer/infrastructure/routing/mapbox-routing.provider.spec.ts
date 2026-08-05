import type { AppConfigService } from '../../../../shared/config/app-config.service';
import { UNREACHABLE } from '../../domain/reachability';
import { MapboxRoutingProvider } from './mapbox-routing.provider';

const points = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0.1 },
];

function configWith(mapboxToken?: string): AppConfigService {
  return {
    maps: { provider: 'mapbox', mapboxToken, requireProvider: false },
  } as AppConfigService;
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

// NAV-4.8 / ADR-0107: acima de 25 pontos a matriz é montada em ladrilhos, em
// vez de cair em Haversine sem avisar ninguém.
describe('MapboxRoutingProvider — acima do limite de 25 coordenadas', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  /** N pontos distintos numa linha, para os geohashes não colidirem. */
  const pontos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ latitude: 38.7 + i * 0.01, longitude: -9.1 }));

  /**
   * Responde qualquer requisição com uma matriz coerente com `sources` e
   * `destinations`, e registra as chamadas feitas.
   */
  function mapboxFake() {
    const chamadas: { coords: number; sources?: string; destinations?: string }[] = [];
    global.fetch = jest.fn(async (url: string) => {
      const u = new URL(url);
      const coords = u.pathname.split('/').pop()!.split(';');
      const sources = u.searchParams.get('sources') ?? undefined;
      const destinations = u.searchParams.get('destinations') ?? undefined;
      chamadas.push({ coords: coords.length, sources, destinations });

      const nS = sources ? sources.split(';').length : coords.length;
      const nD = destinations ? destinations.split(';').length : coords.length;
      // Valores distintos e finitos: 1000 m e 60 s por par.
      const grade = (v: number) =>
        Array.from({ length: nS }, () => Array.from({ length: nD }, () => v));
      return {
        ok: true,
        json: async () => ({ code: 'Ok', distances: grade(1000), durations: grade(60) }),
      };
    }) as unknown as typeof fetch;
    return chamadas;
  }

  it('25 pontos cabem numa requisição só, sem ladrilhar', async () => {
    const chamadas = mapboxFake();

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(pontos(25), 60);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].sources).toBeUndefined();
    expect(m.source).toBe('provider');
    expect(m.distanceKm).toHaveLength(25);
  });

  // O caso que a tarefa nomeia: 26 é o primeiro que não cabe.
  it('26 pontos são ladrilhados, e nenhuma requisição passa de 25 coordenadas', async () => {
    const chamadas = mapboxFake();

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(pontos(26), 60);

    // 26 pontos → 3 blocos (12/12/2) → 9 ladrilhos.
    expect(chamadas).toHaveLength(9);
    for (const c of chamadas) expect(c.coords).toBeLessThanOrEqual(25);
    expect(m.source).toBe('provider');
    // A matriz é completa e sem buraco: nada ficou por preencher.
    expect(m.distanceKm).toHaveLength(26);
    expect(m.distanceKm.every((row) => row.length === 26)).toBe(true);
    expect(m.distanceKm.flat().every((v) => Number.isFinite(v))).toBe(true);
    expect(m.durationMin.flat().every((v) => Number.isFinite(v))).toBe(true);
  });

  it('múltiplos blocos: cada célula recebe o valor do ladrilho certo', async () => {
    mapboxFake();

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(pontos(40), 60);

    // 1000 m e 60 s em todo par, inclusive nos cantos — o remapeamento de
    // índices global↔bloco é o que erra silenciosamente se estiver torto.
    expect(m.distanceKm[0][39]).toBe(1);
    expect(m.distanceKm[39][0]).toBe(1);
    expect(m.distanceKm[25][13]).toBe(1);
    expect(m.durationMin[39][39]).toBe(1);
  });

  // Misturar trecho medido com trecho estimado produz exatamente os custos
  // fictícios que ninguém audita depois: é tudo-ou-nada.
  it('falha em um ladrilho derruba a matriz inteira para geometria', async () => {
    let n = 0;
    global.fetch = jest.fn(async () => {
      n += 1;
      if (n === 3) throw new Error('timeout');
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          distances: [[1000]],
          durations: [[60]],
        }),
      };
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(pontos(26), 60);

    expect(m.source).toBe('geometric');
    // Nenhum resquício do provedor: tudo veio da mesma fonte.
    expect(m.distanceKm.flat().every((v) => Number.isFinite(v))).toBe(true);
  });

  it('acima do teto de ladrilhamento, degrada — mas declarado', async () => {
    const chamadas = mapboxFake();

    const m = await new MapboxRoutingProvider(configWith('tok')).matrix(pontos(101), 60);

    expect(chamadas).toHaveLength(0); // nem tenta
    expect(m.source).toBe('geometric');
  });

  // Quem contratou ETA medido prefere não receber rota a receber uma rota que
  // parece medida e não é.
  it('com MAPS_REQUIRE_PROVIDER, a degradação vira erro claro', async () => {
    mapboxFake();
    const estrito = {
      maps: { provider: 'mapbox', mapboxToken: 'tok', requireProvider: true },
    } as AppConfigService;

    await expect(new MapboxRoutingProvider(estrito).matrix(pontos(101), 60)).rejects.toThrow(
      /MAPS_REQUIRE_PROVIDER/,
    );
  });
});
