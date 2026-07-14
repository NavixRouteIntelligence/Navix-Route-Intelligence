import { haversineKm, type LatLng } from '../../../shared/kernel/geo';
import type { DriverProfile } from './driver-profile';
import type { TrafficModelPort } from './traffic-model';

export interface ScheduleStopInput {
  id: string;
  point: LatLng;
  serviceMinutes?: number;
  window?: { start: Date; end: Date } | null;
}

export interface ScheduleInput {
  origin?: LatLng | null;
  stops: ScheduleStopInput[];
  departure: Date;
  /** Velocidade base do veículo (km/h). */
  baseSpeedKmh: number;
  driver: DriverProfile;
  traffic: TrafficModelPort;
}

export interface ScheduledStop {
  id: string;
  sequence: number;
  etaMinutes: number;
  arrivalAt: Date;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
  serviceMinutes: number;
  timeWindowRespected: boolean | null;
  /** Minutos de atraso vs. o fim da janela (0 se no prazo; null sem janela). */
  minutesLate: number | null;
}

export interface RouteSchedule {
  departure: Date;
  completion: Date;
  totalMinutes: number;
  totalDistanceKm: number;
  stops: ScheduledStop[];
}

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Cronograma detalhado: **ETA por parada** e **conclusão da rota** (ADR-0025).
 * Combina a velocidade efetiva do motorista (perfil aprendido), a **previsão de
 * trânsito** por trecho/instante e o tempo de atendimento por parada. Puro e
 * determinístico. A rota é um caminho aberto (não retorna à origem).
 */
export function buildSchedule(input: ScheduleInput): RouteSchedule {
  const { origin, stops, departure, baseSpeedKmh, driver, traffic } = input;
  const effectiveSpeed = Math.max(1, baseSpeedKmh * driver.speedFactor);

  let clock = 0; // minutos desde a partida
  let cumulative = 0;
  let prev: LatLng | null = origin ?? null;
  const scheduled: ScheduledStop[] = [];

  stops.forEach((stop, i) => {
    const legKm = prev ? haversineKm(prev, stop.point) : 0;
    const legStartAt = new Date(departure.getTime() + clock * 60_000);
    const factor = legKm > 0 ? traffic.factor(stop.point, legStartAt) : 1;
    const travelMin = (legKm / effectiveSpeed) * 60 * factor;

    clock += travelMin;
    cumulative += legKm;
    const arrivalAt = new Date(departure.getTime() + clock * 60_000);
    const serviceMinutes = stop.serviceMinutes ?? driver.serviceTimeMinutes;
    const minutesLate = stop.window
      ? round(Math.max(0, (arrivalAt.getTime() - stop.window.end.getTime()) / 60_000), 1)
      : null;
    const timeWindowRespected = stop.window ? minutesLate === 0 : null;

    scheduled.push({
      id: stop.id,
      sequence: i + 1,
      etaMinutes: round(clock, 1),
      arrivalAt,
      legDistanceKm: round(legKm),
      cumulativeDistanceKm: round(cumulative),
      serviceMinutes,
      timeWindowRespected,
      minutesLate,
    });

    clock += serviceMinutes;
    prev = stop.point;
  });

  return {
    departure,
    completion: new Date(departure.getTime() + clock * 60_000),
    totalMinutes: round(clock, 1),
    totalDistanceKm: round(cumulative),
    stops: scheduled,
  };
}
