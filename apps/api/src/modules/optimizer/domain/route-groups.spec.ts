import type { DestinationType, RouteStopView } from '@navix/contracts';

import { buildRouteGroups } from './route-groups';

const stop = (
  sequence: number,
  type: DestinationType | undefined,
  legDistanceKm: number,
  etaMinutes: number,
): RouteStopView => ({
  sequence,
  deliveryId: `d${sequence}`,
  latitude: -23.5,
  longitude: -46.6,
  priority: 'normal',
  legDistanceKm,
  cumulativeDistanceKm: 0,
  etaMinutes,
  timeWindowRespected: null,
  ...(type ? { destinationType: type } : {}),
});

describe('buildRouteGroups', () => {
  it('agrupa por tipo e ordena pela primeira aparição na rota', () => {
    const groups = buildRouteGroups([
      stop(1, 'commerce', 2, 10),
      stop(2, 'residence', 3, 25),
      stop(3, 'commerce', 1, 32),
    ]);

    expect(groups.map((g) => g.type)).toEqual(['commerce', 'residence']);
    expect(groups.map((g) => g.order)).toEqual([1, 2]);
    expect(groups[0].stops).toBe(2);
    expect(groups[0].sequences).toEqual([1, 3]);
  });

  it('os grupos particionam exatamente a distância e o tempo da rota', () => {
    const stops = [
      stop(1, 'commerce', 2.5, 10),
      stop(2, 'residence', 3.25, 25),
      stop(3, 'apartment', 1.75, 40),
      stop(4, 'commerce', 4.5, 62),
    ];

    const groups = buildRouteGroups(stops);

    const totalDistance = stops.reduce((sum, s) => sum + s.legDistanceKm, 0);
    const groupDistance = groups.reduce((sum, g) => sum + g.distanceKm, 0);
    expect(groupDistance).toBeCloseTo(totalDistance, 2);

    // O ETA da última parada é o tempo total da rota.
    const groupTime = groups.reduce((sum, g) => sum + g.timeMinutes, 0);
    expect(groupTime).toBeCloseTo(62, 2);
  });

  it('paradas sem classificação caem em "other"', () => {
    const groups = buildRouteGroups([stop(1, undefined, 1, 5), stop(2, undefined, 1, 10)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('other');
    expect(groups[0].stops).toBe(2);
  });

  it('respeita a sequência mesmo se as paradas chegarem fora de ordem', () => {
    const groups = buildRouteGroups([
      stop(3, 'residence', 1, 30),
      stop(1, 'commerce', 1, 10),
      stop(2, 'residence', 1, 20),
    ]);

    // Comércio aparece primeiro na ROTA, apesar de vir depois no array.
    expect(groups[0].type).toBe('commerce');
    expect(groups[1].sequences).toEqual([2, 3]);
    expect(groups[1].timeMinutes).toBeCloseTo(20, 2);
  });

  it('não produz tempo negativo com ETA não-monotônico (plano antigo)', () => {
    const groups = buildRouteGroups([stop(1, 'commerce', 1, 30), stop(2, 'residence', 1, 10)]);

    expect(groups.every((g) => g.timeMinutes >= 0)).toBe(true);
  });

  it('rota vazia não gera grupos', () => {
    expect(buildRouteGroups([])).toEqual([]);
  });
});
