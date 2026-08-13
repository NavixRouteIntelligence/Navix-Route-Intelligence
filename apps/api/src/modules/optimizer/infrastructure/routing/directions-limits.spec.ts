import { Logger } from '@nestjs/common';

import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { LatLng } from '../../../../shared/kernel/geo';
import type { LineCoordinate } from '../../domain/polyline';
import { OptimizerMetrics } from '../observability/optimizer-metrics';
import { MapboxDirectionsProvider, chunkPoints } from './mapbox-directions.provider';

/** Limite de coordenadas por requisição da Directions API. */
const LIMITE = 25;

function configWith(mapboxToken?: string): AppConfigService {
  return {
    maps: { provider: 'mapbox', mapboxToken, requireProvider: false },
  } as AppConfigService;
}

function metricsStub() {
  return {
    observeGeometry: jest.fn(),
    observeGeometryHttp: jest.fn(),
  } as unknown as OptimizerMetrics;
}

function pontos(n: number): LatLng[] {
  return Array.from({ length: n }, (_, i) => ({
    latitude: 38.7 + i * 0.002,
    longitude: -9.1 - i * 0.002,
  }));
}

function encodePolyline6(coordinates: LineCoordinate[]): string {
  let saida = '';
  let latAnterior = 0;
  let lngAnterior = 0;
  for (const [lng, lat] of coordinates) {
    const latE6 = Math.round(lat * 1e6);
    const lngE6 = Math.round(lng * 1e6);
    saida += encodeValue(latE6 - latAnterior) + encodeValue(lngE6 - lngAnterior);
    latAnterior = latE6;
    lngAnterior = lngE6;
  }
  return saida;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let saida = '';
  while (v >= 0x20) {
    saida += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return saida + String.fromCharCode(v + 63);
}

/**
 * Provedor que devolve, para cada troço, uma linha que **liga exatamente as
 * coordenadas pedidas**.
 *
 * É o que permite verificar a continuidade: se o particionamento perdesse o
 * ponto de junção, a linha colada teria um salto entre a última coordenada de
 * um troço e a primeira do seguinte.
 */
function provedorQueSegueOsPontos() {
  const coordenadasPorPedido: LatLng[][] = [];

  global.fetch = jest.fn(async (url: unknown) => {
    const texto = String(url);
    const caminho = texto.split('?')[0];
    const bruto = caminho.slice(caminho.lastIndexOf('/') + 1);
    const pedidos = bruto.split(';').map((par) => {
      const [lng, lat] = par.split(',').map(Number);
      return { latitude: lat, longitude: lng };
    });
    coordenadasPorPedido.push(pedidos);

    const linha: LineCoordinate[] = pedidos.map((p) => [p.longitude, p.latitude]);
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 'Ok', routes: [{ geometry: encodePolyline6(linha) }] }),
    } as Response;
  }) as unknown as typeof fetch;

  return { coordenadasPorPedido };
}

/** Distância em graus entre dois vértices — só para detetar saltos. */
function salto(a: LineCoordinate, b: LineCoordinate): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe('limites da Directions por tamanho de rota', () => {
  const originalFetch = global.fetch;
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([2, 10, 25, 26, 50, 100])(
    'com %i paradas, nenhuma requisição excede o limite',
    async (n) => {
      const { coordenadasPorPedido } = provedorQueSegueOsPontos();

      await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(pontos(n));

      expect(coordenadasPorPedido.length).toBeGreaterThan(0);
      for (const pedido of coordenadasPorPedido) {
        expect(pedido.length).toBeLessThanOrEqual(LIMITE);
      }
    },
  );

  it.each([1])('com %i parada não há traçado nem pedido', async (n) => {
    const { coordenadasPorPedido } = provedorQueSegueOsPontos();

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
      pontos(n),
    );

    expect(g).toBeNull();
    expect(coordenadasPorPedido).toHaveLength(0);
  });

  it.each([2, 10, 25, 26, 50, 100])(
    'com %i paradas, a linha colada não tem saltos',
    async (n) => {
      // O critério de aceite: o particionamento não cria linhas entre pontos
      // desconectados. Com o ponto de junção repetido, o maior salto entre
      // vértices consecutivos da linha colada é o mesmo que existe **dentro**
      // de um troço; sem ele, haveria um salto do tamanho de uma perna inteira
      // exatamente na fronteira.
      provedorQueSegueOsPontos();

      const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
        pontos(n),
      );

      const linha = g!.coordinates;
      let maior = 0;
      for (let i = 1; i < linha.length; i++) {
        maior = Math.max(maior, salto(linha[i - 1], linha[i]));
      }

      // Os pontos do fixture estão a 0.002° de distância uns dos outros; um
      // salto de junção perdida seria pelo menos o dobro disso.
      expect(maior).toBeLessThan(0.004);
    },
  );

  it.each([2, 10, 25, 26, 50, 100])(
    'com %i paradas, a linha passa por todas elas e pela ordem certa',
    async (n) => {
      // «Preservar a sequência»: a linha tem de conter cada parada, e por
      // ordem. Uma junção mal feita perderia uma delas em silêncio.
      provedorQueSegueOsPontos();

      const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
        pontos(n),
      );

      const linha = g!.coordinates;
      expect(linha).toHaveLength(n);
      for (let i = 0; i < n; i++) {
        expect(linha[i][1]).toBeCloseTo(pontos(n)[i].latitude, 5);
        expect(linha[i][0]).toBeCloseTo(pontos(n)[i].longitude, 5);
      }
      expect(g!.coveredStops).toBe(n);
    },
  );

  it('a origem é só mais uma coordenada — 26 já não cabem num pedido', async () => {
    // Origem + 25 entregas. É o caso que uma contagem esquecida da origem
    // deixaria passar como «cabe».
    const espia25 = provedorQueSegueOsPontos();
    await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(pontos(25));
    expect(espia25.coordenadasPorPedido).toHaveLength(1);

    const espia26 = provedorQueSegueOsPontos();
    await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(pontos(26));
    expect(espia26.coordenadasPorPedido.length).toBeGreaterThan(1);
  });

  it('rota grande demais não emite dezenas de pedidos', async () => {
    // Orçamento de chamadas: cada troço é um pedido pago, e mais vale não ter
    // traçado do que emitir dezenas por cada abertura da tela.
    const { coordenadasPorPedido } = provedorQueSegueOsPontos();

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
      pontos(400),
    );

    expect(g).toBeNull();
    expect(coordenadasPorPedido).toHaveLength(0);
  });

  it('um 503 num troço é repetido, e a linha sai inteira', async () => {
    let chamada = 0;
    global.fetch = jest.fn(async (url: unknown) => {
      chamada += 1;
      if (chamada === 1) return { ok: false, status: 503, json: async () => ({}) } as Response;
      const texto = String(url);
      const caminho = texto.split('?')[0];
      const bruto = caminho.slice(caminho.lastIndexOf('/') + 1);
      const linha: LineCoordinate[] = bruto.split(';').map((par) => {
        const [lng, lat] = par.split(',').map(Number);
        return [lng, lat] as LineCoordinate;
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 'Ok', routes: [{ geometry: encodePolyline6(linha) }] }),
      } as Response;
    }) as unknown as typeof fetch;

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
      pontos(10),
    );

    expect(g).not.toBeNull();
    expect(chamada).toBe(2);
  });
});

describe('chunkPoints por tamanho', () => {
  it.each([
    [1, 1],
    [2, 1],
    [10, 1],
    [25, 1],
    [26, 2],
    [50, 3],
    [100, 5],
  ])('%i pontos dão %i troços', (n, esperado) => {
    expect(chunkPoints(pontos(n))).toHaveLength(esperado);
  });

  it.each([26, 50, 100])(
    'com %i pontos, cada troço começa onde o anterior acabou',
    (n) => {
      const troços = chunkPoints(pontos(n));

      for (let i = 1; i < troços.length; i++) {
        const anterior = troços[i - 1][troços[i - 1].length - 1];
        expect(troços[i][0]).toEqual(anterior);
      }
    },
  );
});
