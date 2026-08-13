import { Logger } from '@nestjs/common';

import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { LatLng } from '../../../../shared/kernel/geo';
import { MAX_COORDS_BY_PROFILE, blockSizeFor } from '../../domain/matrix-profile';
import { UNREACHABLE } from '../../domain/reachability';
import { OptimizerMetrics } from '../observability/optimizer-metrics';
import { MapboxRoutingProvider } from './mapbox-routing.provider';

/**
 * Limites do provedor, verificados nos tamanhos que a T8.8 exige: 1, 2, 10, 25,
 * 26, 50 e 100 paradas.
 *
 * 25 e 26 são o par que interessa: **origem + 25 entregas são 26 coordenadas**,
 * e é aí que uma contagem que se esquece da origem passa de «cabe» para «não
 * cabe» sem ninguém notar — a requisição volta 422 e a matriz inteira degrada.
 */

function configWith(mapboxToken?: string): AppConfigService {
  return {
    maps: { provider: 'mapbox', mapboxToken, requireProvider: false },
  } as AppConfigService;
}

function metricsStub() {
  return {
    observeMatrix: jest.fn(),
    observeMatrixFallback: jest.fn(),
    observeMatrixHttp: jest.fn(),
    observeMatrixCoordsExceeded: jest.fn(),
  } as unknown as OptimizerMetrics;
}

function pontos(n: number): LatLng[] {
  return Array.from({ length: n }, (_, i) => ({
    latitude: 38.7 + i * 0.002,
    longitude: -9.1 - i * 0.002,
  }));
}

/** Quantas coordenadas cada requisição levou, lido da própria URL. */
function espiaProvedor() {
  const coordenadasPorPedido: number[] = [];
  const perfis: string[] = [];

  global.fetch = jest.fn(async (url: unknown) => {
    const texto = String(url);
    const caminho = texto.split('?')[0];
    const coords = caminho.slice(caminho.lastIndexOf('/') + 1);
    const n = coords.split(';').length;
    coordenadasPorPedido.push(n);
    perfis.push(/mapbox\/([a-z-]+)\//.exec(texto)?.[1] ?? '');

    const params = new URLSearchParams(texto.split('?')[1] ?? '');
    const linhas = params.get('sources')?.split(';').length ?? n;
    const colunas = params.get('destinations')?.split(';').length ?? n;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        distances: Array.from({ length: linhas }, () => new Array(colunas).fill(1000)),
        durations: Array.from({ length: linhas }, () => new Array(colunas).fill(120)),
      }),
    } as Response;
  }) as unknown as typeof fetch;

  return { coordenadasPorPedido, perfis };
}

/**
 * Provedor cujas células carregam a identidade do par.
 *
 * O índice é recuperado da latitude (`38.7 + i * 0.002`), então a célula
 * `(i, j)` volta como `i * 1000 + j` metros. Qualquer ladrilho colocado na
 * posição errada, transposto ou deslocado produz um valor que não bate.
 */
function provedorIdentificavel() {
  const indiceDe = (lat: number) => Math.round((lat - 38.7) / 0.002);

  global.fetch = jest.fn(async (url: unknown) => {
    const texto = String(url);
    const caminho = texto.split('?')[0];
    const bruto = caminho.slice(caminho.lastIndexOf('/') + 1);
    const coords = bruto.split(';').map((par) => {
      const [lng, lat] = par.split(',').map(Number);
      return { latitude: lat, longitude: lng };
    });

    const params = new URLSearchParams(texto.split('?')[1] ?? '');
    const sources = params.get('sources')?.split(';').map(Number) ?? coords.map((_, k) => k);
    const destinations =
      params.get('destinations')?.split(';').map(Number) ?? coords.map((_, k) => k);

    const distances = sources.map((s) =>
      destinations.map((d) => indiceDe(coords[s].latitude) * 1000 + indiceDe(coords[d].latitude)),
    );
    const durations = distances.map((linha) => linha.map(() => 60));

    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 'Ok', distances, durations }),
    } as Response;
  }) as unknown as typeof fetch;
}

describe('limites do Matrix por tamanho de rota', () => {
  const originalFetch = global.fetch;
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([1, 2, 10, 25, 26, 50, 100])(
    'com %i pontos, nenhuma requisição excede o limite do perfil',
    async (n) => {
      const { coordenadasPorPedido } = espiaProvedor();

      await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(pontos(n), 40);

      for (const coords of coordenadasPorPedido) {
        expect(coords).toBeLessThanOrEqual(MAX_COORDS_BY_PROFILE.driving);
      }
    },
  );

  it.each([2, 10, 25, 26, 50, 100])(
    'com %i pontos, a matriz sai completa e quadrada',
    async (n) => {
      espiaProvedor();

      const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
        pontos(n),
        40,
      );

      expect(m.distanceKm).toHaveLength(n);
      expect(m.durationMin).toHaveLength(n);
      for (const linha of m.distanceKm) {
        expect(linha).toHaveLength(n);
        // Nenhuma célula fica por preencher: o ladrilhamento cobre a matriz
        // toda, e uma célula esquecida ficaria em `UNREACHABLE` — a aresta que
        // o otimizador nunca escolheria, sem nada a dizer porquê.
        for (const celula of linha) expect(celula).not.toBe(UNREACHABLE);
      }
    },
  );

  it.each([2, 10, 25, 26, 50, 100])(
    'com %i pontos, cada célula vem do par certo',
    async (n) => {
      // O teste acima usa valores constantes e por isso **não** detetaria um
      // ladrilho trocado de sítio ou transposto: todas as células seriam
      // iguais. Aqui cada célula carrega a identidade do seu par, recuperada
      // da própria coordenada, e um ladrilho fora do lugar aparece.
      provedorIdentificavel();

      const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
        pontos(n),
        40,
      );

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          expect(m.distanceKm[i][j]).toBeCloseTo((i * 1000 + j) / 1000, 6);
        }
      }
    },
  );

  it('25 pontos cabem numa requisição só; 26 já não', async () => {
    // O par que a origem cria: origem + 25 entregas.
    const espia25 = espiaProvedor();
    await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(pontos(25), 40);
    expect(espia25.coordenadasPorPedido).toHaveLength(1);

    const espia26 = espiaProvedor();
    await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(pontos(26), 40);
    expect(espia26.coordenadasPorPedido.length).toBeGreaterThan(1);
  });

  it('acima de 100 pontos degrada para geometria, e diz que degradou', async () => {
    espiaProvedor();
    const metrics = metricsStub();

    const m = await new MapboxRoutingProvider(configWith('tok'), metrics).matrix(pontos(101), 40);

    // O problema nunca foi degradar — foi degradar em silêncio (ADR-0107).
    expect(m.source).toBe('geometric');
    expect(metrics.observeMatrixCoordsExceeded).toHaveBeenCalled();
  });
});

describe('trânsito em tempo real', () => {
  const originalFetch = global.fetch;
  /**
   * A partida tem de ser perto do **agora real**: a janela de trânsito é
   * medida contra `new Date()`, e uma data fixa cairia sempre em «não parte
   * agora» — o teste passaria a verificar a coisa errada.
   */
  const agora = () => new Date();
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uma rota que parte agora e cabe em 10 pontos recebe trânsito', async () => {
    const { perfis } = espiaProvedor();

    const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
      pontos(10),
      40,
      'car',
      agora(),
    );

    expect(perfis[0]).toBe('driving-traffic');
    expect(m.profile?.profile).toBe('driving-traffic');
    expect(m.profile?.trafficDenied).toBeUndefined();
  });

  it('acima de 10 pontos o trânsito é recusado — e a recusa fica registada', async () => {
    // O critério de aceite: nunca há fallback silencioso apresentado como
    // trânsito real. O perfil gravado já era honesto sobre **o quê**; faltava
    // dizer que alguém ia sair agora e não recebeu o trânsito por não caber.
    const { perfis } = espiaProvedor();

    const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
      pontos(11),
      40,
      'car',
      agora(),
    );

    expect(perfis.every((p) => p === 'driving')).toBe(true);
    expect(m.profile?.profile).toBe('driving');
    expect(m.profile?.trafficDenied).toBe('too-many-points');
  });

  it('sem horário de partida não há recusa a registar', async () => {
    // Uma rota sem horário nunca quis trânsito: marcar recusa aqui inventaria
    // uma perda que não houve.
    espiaProvedor();

    const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
      pontos(30),
      40,
      'car',
    );

    expect(m.profile?.trafficDenied).toBeUndefined();
  });

  it('uma bicicleta não perde trânsito, porque nunca o teve', async () => {
    espiaProvedor();

    const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
      pontos(30),
      15,
      'bicycle',
      agora(),
    );

    expect(m.profile?.profile).toBe('cycling');
    expect(m.profile?.trafficDenied).toBeUndefined();
  });

  it('o bloco do ladrilhamento cabe no limite de qualquer perfil', () => {
    // Hoje o `driving-traffic` nunca ladrilha — só é escolhido quando cabe numa
    // requisição. Isso é uma coincidência entre duas regras distantes, e este
    // teste é o que a torna uma invariante: dois blocos concatenados têm de
    // caber no limite, em **todos** os perfis.
    for (const [perfil, limite] of Object.entries(MAX_COORDS_BY_PROFILE)) {
      expect(blockSizeFor(perfil as keyof typeof MAX_COORDS_BY_PROFILE) * 2).toBeLessThanOrEqual(
        limite,
      );
    }
  });
});

describe('resiliência das chamadas', () => {
  const originalFetch = global.fetch;
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('um 503 é repetido uma vez e a matriz sai medida', async () => {
    let chamada = 0;
    global.fetch = jest.fn(async () => {
      chamada += 1;
      if (chamada === 1) return { ok: false, status: 503, json: async () => ({}) } as Response;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 'Ok',
          distances: [
            [0, 1000],
            [1000, 0],
          ],
          durations: [
            [0, 120],
            [120, 0],
          ],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
      pontos(2),
      40,
    );

    expect(m.source).toBe('provider');
    expect(chamada).toBe(2);
  });

  it('um 422 não é repetido — o pedido é que está errado', async () => {
    let chamada = 0;
    global.fetch = jest.fn(async () => {
      chamada += 1;
      return { ok: false, status: 422, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const m = await new MapboxRoutingProvider(configWith('tok'), metricsStub()).matrix(
      pontos(2),
      40,
    );

    expect(chamada).toBe(1);
    expect(m.source).toBe('geometric');
  });
});
