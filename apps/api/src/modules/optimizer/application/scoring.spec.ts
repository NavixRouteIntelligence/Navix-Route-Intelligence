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
