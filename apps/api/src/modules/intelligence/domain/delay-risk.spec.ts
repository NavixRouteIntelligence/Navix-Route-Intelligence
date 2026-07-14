import { analyzeDelays } from './delay-risk';
import type { RouteSchedule, ScheduledStop } from './route-scheduler';

function stop(id: string, minutesLate: number | null): ScheduledStop {
  return {
    id,
    sequence: 1,
    etaMinutes: 10,
    arrivalAt: new Date(),
    legDistanceKm: 1,
    cumulativeDistanceKm: 1,
    serviceMinutes: 5,
    timeWindowRespected: minutesLate === null ? null : minutesLate === 0,
    minutesLate,
  };
}

function schedule(stops: ScheduledStop[]): RouteSchedule {
  return { departure: new Date(), completion: new Date(), totalMinutes: 0, totalDistanceKm: 0, stops };
}

describe('analyzeDelays', () => {
  it('sem atrasos: lista vazia', () => {
    expect(analyzeDelays(schedule([stop('a', 0), stop('b', null)]))).toEqual([]);
  });

  it('classifica severidade e sugere mitigação por atraso', () => {
    const risks = analyzeDelays(schedule([stop('a', 5), stop('b', 15), stop('c', 40)]));
    expect(risks.map((r) => [r.stopId, r.severity])).toEqual([
      ['a', 'low'],
      ['b', 'medium'],
      ['c', 'high'],
    ]);
    for (const r of risks) {
      expect(r.minutesLate).toBeGreaterThan(0);
      expect(r.mitigation.length).toBeGreaterThan(0);
    }
  });
});
