import { buildSchedule, type ScheduleInput } from './route-scheduler';

export interface DeparturePlan {
  departure: Date;
  expectedLateStops: number;
  totalLatenessMin: number;
}

const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Melhor horário de saída (ADR-0025): varre horários candidatos a partir do
 * "mais cedo permitido" e escolhe o que **minimiza atrasos** — considerando a
 * previsão de trânsito por horário (sair no pico é mais lento), as janelas de
 * entrega e o perfil do motorista. Desempate: menos atraso total e, então,
 * saída mais cedo. Reusa o `buildSchedule` (mesma semântica do cronograma).
 */
export function planDeparture(
  base: Omit<ScheduleInput, 'departure'>,
  earliest: Date,
  horizonMin = 180,
  stepMin = 15,
): DeparturePlan {
  let best: DeparturePlan | null = null;

  for (let m = 0; m <= horizonMin; m += stepMin) {
    const departure = new Date(earliest.getTime() + m * 60_000);
    const schedule = buildSchedule({ ...base, departure });
    const late = schedule.stops.filter((s) => (s.minutesLate ?? 0) > 0);
    const candidate: DeparturePlan = {
      departure,
      expectedLateStops: late.length,
      totalLatenessMin: round(late.reduce((a, s) => a + (s.minutesLate ?? 0), 0)),
    };
    if (best === null || isBetter(candidate, best)) best = candidate;
  }

  // horizonMin >= 0 garante ao menos um candidato.
  return best as DeparturePlan;
}

function isBetter(a: DeparturePlan, b: DeparturePlan): boolean {
  if (a.expectedLateStops !== b.expectedLateStops) return a.expectedLateStops < b.expectedLateStops;
  if (a.totalLatenessMin !== b.totalLatenessMin) return a.totalLatenessMin < b.totalLatenessMin;
  return a.departure.getTime() < b.departure.getTime();
}
