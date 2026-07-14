import { planDeparture } from './departure-planner';
import { NEUTRAL_DRIVER_PROFILE } from './driver-profile';
import type { ScheduleInput } from './route-scheduler';
import type { TrafficModelPort } from './traffic-model';

const T0 = new Date('2026-07-14T08:00:00.000Z');
const cutoff = new Date(T0.getTime() + 30 * 60_000); // pico até T0+30

// Trânsito pesado (x3) antes do cutoff, livre (x1) depois — simula fim do pico.
const rushThenFree: TrafficModelPort = {
  factor: (_p, at) => (at.getTime() < cutoff.getTime() ? 3 : 1),
};

const base: Omit<ScheduleInput, 'departure'> = {
  origin: { latitude: 0, longitude: 0 },
  // ~20 km a leste → 20 min livre, 60 min no pico (a 60 km/h).
  stops: [
    {
      id: 'x',
      point: { latitude: 0, longitude: 0.18 },
      window: { start: T0, end: new Date(T0.getTime() + 50 * 60_000) }, // fim em T0+50
    },
  ],
  baseSpeedKmh: 60,
  driver: NEUTRAL_DRIVER_PROFILE,
  traffic: rushThenFree,
};

describe('planDeparture', () => {
  it('escolhe sair após o pico para cumprir a janela (melhor horário de saída)', () => {
    const plan = planDeparture(base, T0, 60, 15);
    expect(plan.expectedLateStops).toBe(0);
    // Sair em T0 (pico) chegaria atrasado; o plano espera ~30 min (fim do pico).
    expect(plan.departure.getTime()).toBe(cutoff.getTime());
  });

  it('sem janelas: sai o mais cedo possível', () => {
    const noWindows: Omit<ScheduleInput, 'departure'> = {
      ...base,
      stops: [{ id: 'x', point: { latitude: 0, longitude: 0.18 } }],
    };
    const plan = planDeparture(noWindows, T0, 60, 15);
    expect(plan.expectedLateStops).toBe(0);
    expect(plan.departure.getTime()).toBe(T0.getTime());
  });
});
