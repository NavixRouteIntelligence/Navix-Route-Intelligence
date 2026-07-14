import { NEUTRAL_DRIVER_PROFILE } from './driver-profile';
import { buildSchedule, type ScheduleInput } from './route-scheduler';
import type { TrafficModelPort } from './traffic-model';

const constantTraffic = (factor: number): TrafficModelPort => ({ factor: () => factor });

const departure = new Date('2026-07-14T08:00:00.000Z');

function baseInput(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    origin: null,
    stops: [
      { id: 'a', point: { latitude: 0, longitude: 0 } },
      { id: 'b', point: { latitude: 0, longitude: 0.1 } },
    ],
    departure,
    baseSpeedKmh: 60,
    driver: NEUTRAL_DRIVER_PROFILE,
    traffic: constantTraffic(1),
    ...overrides,
  };
}

describe('buildSchedule', () => {
  it('primeira parada sem origem: ETA 0; segunda acumula deslocamento', () => {
    const s = buildSchedule(baseInput());
    expect(s.stops[0].etaMinutes).toBe(0);
    expect(s.stops[0].cumulativeDistanceKm).toBe(0);
    expect(s.stops[1].etaMinutes).toBeGreaterThan(0);
    expect(s.stops[1].cumulativeDistanceKm).toBeGreaterThan(0);
    expect(s.completion.getTime()).toBeGreaterThan(s.departure.getTime());
  });

  it('trânsito mais intenso aumenta o tempo de viagem (dobra a viagem)', () => {
    // Sem tempo de serviço na 1ª parada, a ETA da 2ª é só a viagem → escala 2x.
    const driver = { ...NEUTRAL_DRIVER_PROFILE, serviceTimeMinutes: 0 };
    const free = buildSchedule(baseInput({ driver, traffic: constantTraffic(1) }));
    const jam = buildSchedule(baseInput({ driver, traffic: constantTraffic(2) }));
    expect(jam.stops[1].etaMinutes).toBeCloseTo(free.stops[1].etaMinutes * 2, 0);
  });

  it('marca atraso e minutesLate quando a janela é estourada', () => {
    const s = buildSchedule(
      baseInput({
        stops: [
          { id: 'a', point: { latitude: 0, longitude: 0 } },
          {
            id: 'b',
            point: { latitude: 0, longitude: 0.1 },
            window: { start: departure, end: new Date(departure.getTime() + 60_000) }, // 1 min
          },
        ],
      }),
    );
    expect(s.stops[1].timeWindowRespected).toBe(false);
    expect(s.stops[1].minutesLate).toBeGreaterThan(0);
  });

  it('respeita a janela quando há folga', () => {
    const s = buildSchedule(
      baseInput({
        stops: [
          { id: 'a', point: { latitude: 0, longitude: 0 } },
          {
            id: 'b',
            point: { latitude: 0, longitude: 0.1 },
            window: { start: departure, end: new Date(departure.getTime() + 3_600_000) }, // 1h
          },
        ],
      }),
    );
    expect(s.stops[1].timeWindowRespected).toBe(true);
    expect(s.stops[1].minutesLate).toBe(0);
  });
});
