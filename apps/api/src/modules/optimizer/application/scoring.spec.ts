import type { RouteStopView } from '@navix/contracts';

import { buildStops, computeMetrics, computeSavings, computeScore, type ScoringNode } from './scoring';

describe('scoring', () => {
  // 3 paradas em linha: 0 → 1km → 2km, velocidade tal que 1km = 1min.
  const distance = [
    [0, 1, 2],
    [1, 0, 1],
    [2, 1, 0],
  ];
  const time = distance;
  const nodes: ScoringNode[] = [
    { id: 'a', latitude: 0, longitude: 0, priority: 'high', window: null },
    { id: 'b', latitude: 0, longitude: 1, priority: 'normal', window: null },
    { id: 'c', latitude: 0, longitude: 2, priority: 'low', window: { startMinutes: 0, endMinutes: 1 } },
  ];

  it('computeMetrics soma distância e tempo (sem origem)', () => {
    const m = computeMetrics([0, 1, 2], distance, time, 0, false);
    expect(m.totalDistanceKm).toBe(2);
    expect(m.stops).toBe(3);
  });

  it('buildStops numera a sequência e marca violação de janela', () => {
    const stops = buildStops([0, 1, 2], nodes, distance, time, 0, false);
    expect(stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
    // a parada 'c' chega em 2min mas a janela fecha em 1min → violada
    expect(stops[2].timeWindowRespected).toBe(false);
    expect(stops[0].timeWindowRespected).toBeNull();
  });

  it('computeSavings calcula ganho vs baseline', () => {
    const savings = computeSavings(
      { totalDistanceKm: 10, totalTimeMinutes: 20, stops: 3 },
      { totalDistanceKm: 8, totalTimeMinutes: 16, stops: 3 },
    );
    expect(savings.distanceKm).toBe(2);
    expect(savings.distancePct).toBe(20);
  });

  it('computeScore fica entre 0 e 100', () => {
    const stops = buildStops([0, 1, 2], nodes, distance, time, 0, false);
    const savings = computeSavings(
      { totalDistanceKm: 10, totalTimeMinutes: 20, stops: 3 },
      { totalDistanceKm: 8, totalTimeMinutes: 16, stops: 3 },
    );
    const { score, explanation } = computeScore(stops, savings, 'NN+2opt');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(explanation).toContain('paradas');
  });
});

// NAV-4.5 / ADR-0104: a janela horária deixa de ser decorativa. Os três casos
// que a tarefa exige — chegada antecipada, dentro e depois do limite — mais a
// propagação do que se espera e do que se atende.
describe('scoring — janelas horárias e espera', () => {
  // Três paradas em linha, 1 km = 1 min entre vizinhas.
  const distance = [
    [0, 1, 2],
    [1, 0, 1],
    [2, 1, 0],
  ];
  const time = distance;

  const parada = (
    id: string,
    window: { startMinutes: number; endMinutes: number } | null,
    serviceMinutes?: number,
  ): ScoringNode => ({
    id,
    latitude: 0,
    longitude: 0,
    priority: 'normal',
    window,
    ...(serviceMinutes === undefined ? {} : { serviceMinutes }),
  });

  it('chegada antecipada gera espera e empurra as paradas seguintes', () => {
    // 'b' abre no minuto 30; o veículo chega no minuto 1 e espera 29.
    const nodes = [
      parada('a', null),
      parada('b', { startMinutes: 30, endMinutes: 60 }),
      parada('c', null),
    ];

    const stops = buildStops([0, 1, 2], nodes, distance, time, 0, false);

    expect(stops[1].etaMinutes).toBe(1); // encostou no minuto 1
    expect(stops[1].waitMinutes).toBe(29); // esperou a abertura
    expect(stops[1].timeWindowRespected).toBe(true); // esperar não é desrespeitar
    // 'c' parte do fim da espera, não da chegada: 30 + 1min de trajeto.
    expect(stops[2].etaMinutes).toBe(31);
  });

  it('chegada dentro da janela não gera espera', () => {
    const nodes = [
      parada('a', null),
      parada('b', { startMinutes: 0, endMinutes: 60 }),
      parada('c', null),
    ];

    const stops = buildStops([0, 1, 2], nodes, distance, time, 0, false);

    expect(stops[1].waitMinutes).toBeUndefined();
    expect(stops[1].timeWindowRespected).toBe(true);
    expect(stops[2].etaMinutes).toBe(2);
  });

  it('chegada após o limite é sinalizada, sem ajustar o relógio', () => {
    const nodes = [
      parada('a', null),
      parada('b', { startMinutes: 0, endMinutes: 0.5 }),
      parada('c', null),
    ];

    const stops = buildStops([0, 1, 2], nodes, distance, time, 0, false);

    expect(stops[1].timeWindowRespected).toBe(false);
    expect(stops[1].waitMinutes).toBeUndefined();
    // O ETA não é "corrigido" para dentro da janela.
    expect(stops[1].etaMinutes).toBe(1);
  });

  // O critério pede isto explicitamente, e já era verdade — fica travado.
  it('o tempo de serviço da parada é propagado para as próximas', () => {
    const nodes = [parada('a', null, 10), parada('b', null, 5), parada('c', null)];

    const stops = buildStops([0, 1, 2], nodes, distance, time, 0, false);

    expect(stops[0].etaMinutes).toBe(0);
    expect(stops[1].etaMinutes).toBe(11); // 10 de serviço em 'a' + 1 de trajeto
    expect(stops[2].etaMinutes).toBe(17); // + 5 de serviço em 'b' + 1 de trajeto
  });

  it('a espera entra no tempo total e aparece separada', () => {
    const nodes = [
      parada('a', null),
      parada('b', { startMinutes: 30, endMinutes: 60 }),
      parada('c', null),
    ];

    const m = computeMetrics([0, 1, 2], distance, time, 0, false, nodes);

    expect(m.totalWaitMinutes).toBe(29);
    // 2 min de deslocamento + 29 de espera; sem espera o total mentiria sobre
    // quando o veículo fica livre.
    expect(m.totalTimeMinutes).toBe(31);
    expect(m.lateStops).toBe(0);
  });

  it('as paradas fora da janela são contadas no plano', () => {
    const nodes = [
      parada('a', null),
      parada('b', { startMinutes: 0, endMinutes: 0.5 }),
      parada('c', null),
    ];

    const m = computeMetrics([0, 1, 2], distance, time, 0, false, nodes);

    expect(m.lateStops).toBe(1);
    expect(m.totalWaitMinutes).toBeUndefined();
  });
});

describe('computeScore — a espera aparece na explicação', () => {
  const semEconomia = { distanceKm: 0, timeMinutes: 0, distancePct: 0, timePct: 0 };

  const parada = (over: Partial<RouteStopView> = {}): RouteStopView => ({
    sequence: 1,
    deliveryId: 'd1',
    latitude: 0,
    longitude: 0,
    priority: 'normal',
    legDistanceKm: 0,
    cumulativeDistanceKm: 0,
    etaMinutes: 0,
    timeWindowRespected: true,
    ...over,
  });

  it('declara os minutos de espera quando há', () => {
    const { explanation } = computeScore(
      [parada({ waitMinutes: 29 }), parada({ sequence: 2, deliveryId: 'd2' })],
      semEconomia,
      'Rota',
    );

    expect(explanation).toContain('29 min de espera até abrir janela');
  });

  it('não menciona espera quando não houve', () => {
    const { explanation } = computeScore([parada()], semEconomia, 'Rota');

    expect(explanation).not.toContain('espera');
  });
});
