import { Logger } from '@nestjs/common';

import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { LatLng } from '../../../../shared/kernel/geo';
import type { LineCoordinate } from '../../domain/polyline';
import { OptimizerMetrics } from '../observability/optimizer-metrics';
import { MapboxDirectionsProvider, chunkPoints } from './mapbox-directions.provider';

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

/** Codificador de referência (ver `polyline.spec.ts`). */
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

const linha: LineCoordinate[] = [
  [-9.139337, 38.722252],
  [-9.14211, 38.724001],
  [-9.145, 38.7255],
];

const dois: LatLng[] = [
  { latitude: 38.722252, longitude: -9.139337 },
  { latitude: 38.7255, longitude: -9.145 },
];

function pontos(n: number): LatLng[] {
  return Array.from({ length: n }, (_, i) => ({
    latitude: 38.7 + i * 0.001,
    longitude: -9.1 - i * 0.001,
  }));
}

function respondeCom(body: unknown, ok = true, status = 200) {
  const chamadas: string[] = [];
  global.fetch = jest.fn(async (url: unknown) => {
    chamadas.push(String(url));
    return { ok, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return chamadas;
}

describe('MapboxDirectionsProvider', () => {
  const originalFetch = global.fetch;
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('devolve o traçado descodificado', async () => {
    respondeCom({ code: 'Ok', routes: [{ geometry: encodePolyline6(linha) }] });

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(dois);

    expect(g?.coordinates).toEqual(linha);
    expect(g?.coveredStops).toBe(2);
  });

  it('pede polyline6 e um overview, e não pede passos', async () => {
    // `polyline6` e o descodificador têm de concordar na precisão: lida como
    // `polyline`, a mesma resposta dá coordenadas dez vezes menores — sem erro
    // nenhum, e a rota aparece no Golfo da Guiné.
    const chamadas = respondeCom({ code: 'Ok', routes: [{ geometry: encodePolyline6(linha) }] });

    await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(dois);

    expect(chamadas[0]).toContain('geometries=polyline6');
    expect(chamadas[0]).toContain('overview=');
    expect(chamadas[0]).toContain('steps=false');
    expect(chamadas[0]).toContain('/directions/v5/mapbox/driving/');
  });

  it('o perfil segue o veículo', async () => {
    // Mesma razão da matriz (ADR-0108): uma bicicleta não anda na autoestrada,
    // e um traçado de carro desenha-a lá.
    const chamadas = respondeCom({ code: 'Ok', routes: [{ geometry: encodePolyline6(linha) }] });

    await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
      dois,
      'bicycle',
    );

    expect(chamadas[0]).toContain('/mapbox/cycling/');
  });

  it('sem token não há traçado e não há pedido', async () => {
    const chamadas = respondeCom({ code: 'Ok' });

    const g = await new MapboxDirectionsProvider(configWith(undefined), metricsStub()).geometry(
      dois,
    );

    expect(g).toBeNull();
    expect(chamadas).toHaveLength(0);
  });

  it('menos de dois pontos não é rota', async () => {
    const chamadas = respondeCom({ code: 'Ok' });

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry([
      dois[0],
    ]);

    expect(g).toBeNull();
    expect(chamadas).toHaveLength(0);
  });

  it('erro HTTP devolve nulo em vez de estourar', async () => {
    // O critério de aceite: geometria indisponível nunca impede carregar a rota.
    respondeCom({}, false, 503);

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(dois);

    expect(g).toBeNull();
  });

  it('NoRoute devolve nulo — e não uma reta', async () => {
    // A tentação seria ligar os pontos. Uma reta atravessa quarteirões e rios,
    // e sugere uma distância que não é a que se conduz (ADR-0125).
    respondeCom({ code: 'NoRoute' });

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(dois);

    expect(g).toBeNull();
  });

  it('polyline corrompida devolve nulo', async () => {
    const completa = encodePolyline6(linha);
    respondeCom({ code: 'Ok', routes: [{ geometry: completa.slice(0, -1) }] });

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(dois);

    expect(g).toBeNull();
  });

  it('resposta sem geometria devolve nulo', async () => {
    respondeCom({ code: 'Ok', routes: [{}] });

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(dois);

    expect(g).toBeNull();
  });

  it('um troço em falta cancela a linha inteira', async () => {
    // Colar o que sobra desenharia um salto entre ruas distantes, que se lê
    // como um percurso que ninguém vai fazer.
    let chamada = 0;
    global.fetch = jest.fn(async () => {
      chamada += 1;
      return {
        ok: true,
        status: 200,
        json: async () =>
          chamada === 1 ? { code: 'Ok', routes: [{ geometry: encodePolyline6(linha) }] } : { code: 'NoRoute' },
      } as Response;
    }) as unknown as typeof fetch;

    const g = await new MapboxDirectionsProvider(configWith('tok'), metricsStub()).geometry(
      pontos(30),
    );

    expect(g).toBeNull();
  });

  it('a métrica distingue os desfechos', async () => {
    const metrics = metricsStub();
    respondeCom({ code: 'NoRoute' });

    await new MapboxDirectionsProvider(configWith('tok'), metrics).geometry(dois);

    // Sem traçado a rota funciona à mesma, então isto não é um alarme — é o
    // que distingue «ninguém pediu» de «pedimos e não veio».
    expect(metrics.observeGeometry).toHaveBeenCalled();
  });
});

describe('chunkPoints', () => {
  it('até 25 pontos é um pedido só', () => {
    expect(chunkPoints(pontos(25))).toHaveLength(1);
  });

  it('acima disso parte, repetindo o ponto de junção', () => {
    const troços = chunkPoints(pontos(30));

    expect(troços).toHaveLength(2);
    // Sem a repetição faltaria o traçado exatamente entre a parada 25 e a 26 —
    // o buraco mais fácil de não notar, porque a linha continua.
    expect(troços[0][troços[0].length - 1]).toEqual(troços[1][0]);
  });

  it('cobre todos os pontos sem perder nenhum', () => {
    const originais = pontos(60);
    const troços = chunkPoints(originais);

    const vistos = new Set(troços.flat().map((p) => `${p.latitude},${p.longitude}`));

    expect(vistos.size).toBe(originais.length);
  });

  it('nenhum troço excede o limite do provedor', () => {
    for (const troço of chunkPoints(pontos(120))) {
      expect(troço.length).toBeLessThanOrEqual(25);
    }
  });
});
