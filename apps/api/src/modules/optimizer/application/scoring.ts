import type { DeliveryPriority, RouteMetrics, RouteSavings, RouteStopView } from '@navix/contracts';

import type { NodeWindow } from '../domain/ports/route-optimization-strategy.port';
import { priorityWeight } from '../domain/optimization-stop';

export interface ScoringNode {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  window: NodeWindow | null;
}

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Métricas agregadas de uma ordenação de nós. */
export function computeMetrics(
  order: number[],
  distance: number[][],
  time: number[][],
  serviceMinutes: number,
  hasOrigin: boolean,
): RouteMetrics {
  let totalDistance = 0;
  let totalTime = 0;
  for (let i = 1; i < order.length; i++) {
    totalDistance += distance[order[i - 1]][order[i]];
    totalTime += time[order[i - 1]][order[i]];
  }
  const deliveryStops = hasOrigin ? order.length - 1 : order.length;
  totalTime += serviceMinutes * deliveryStops;
  return {
    totalDistanceKm: round(totalDistance),
    totalTimeMinutes: round(totalTime),
    stops: deliveryStops,
  };
}

/** Constrói a visão por parada (exclui a origem, se houver). */
export function buildStops(
  order: number[],
  nodes: ScoringNode[],
  distance: number[][],
  time: number[][],
  serviceMinutes: number,
  hasOrigin: boolean,
): RouteStopView[] {
  const views: RouteStopView[] = [];
  let cumulativeDistance = 0;
  let clock = 0; // minutos desde a partida (chegada ao nó atual)
  let sequence = 0;

  for (let i = 0; i < order.length; i++) {
    const node = order[i];
    const leg = i === 0 ? 0 : distance[order[i - 1]][node];
    const legTime = i === 0 ? 0 : time[order[i - 1]][node];
    cumulativeDistance += leg;
    clock += legTime;

    const isOrigin = hasOrigin && i === 0;
    if (!isOrigin) {
      const n = nodes[node];
      const respected = n.window === null ? null : clock <= n.window.endMinutes + 1e-6;
      sequence += 1;
      views.push({
        sequence,
        deliveryId: n.id,
        latitude: n.latitude,
        longitude: n.longitude,
        priority: n.priority,
        legDistanceKm: round(leg),
        cumulativeDistanceKm: round(cumulativeDistance),
        etaMinutes: round(clock, 1),
        timeWindowRespected: respected,
      });
      clock += serviceMinutes; // tempo de serviço na parada
    }
  }
  return views;
}

export function computeSavings(baseline: RouteMetrics, optimized: RouteMetrics): RouteSavings {
  const distanceKm = round(baseline.totalDistanceKm - optimized.totalDistanceKm);
  const timeMinutes = round(baseline.totalTimeMinutes - optimized.totalTimeMinutes);
  const distancePct =
    baseline.totalDistanceKm > 0 ? round((distanceKm / baseline.totalDistanceKm) * 100, 1) : 0;
  const timePct =
    baseline.totalTimeMinutes > 0 ? round((timeMinutes / baseline.totalTimeMinutes) * 100, 1) : 0;
  return { distanceKm, timeMinutes, distancePct, timePct };
}

/** Fração de prioridades respeitadas (urgentes antes de menos urgentes). */
function priorityScore(stops: RouteStopView[]): number {
  const weights = stops.map((s) => priorityWeight(s.priority));
  let inversions = 0;
  let comparable = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = i + 1; j < weights.length; j++) {
      if (weights[i] !== weights[j]) {
        comparable += 1;
        if (weights[i] < weights[j]) inversions += 1; // urgente veio depois
      }
    }
  }
  return comparable === 0 ? 1 : 1 - inversions / comparable;
}

export interface ScoreResult {
  score: number;
  explanation: string;
}

/**
 * Score 0–100 = 50% respeito às janelas + 30% respeito às prioridades +
 * 20% eficiência (economia de distância vs. ordem original).
 */
export function computeScore(
  stops: RouteStopView[],
  savings: RouteSavings,
  strategyLabel: string,
): ScoreResult {
  const windowStops = stops.filter((s) => s.timeWindowRespected !== null);
  const respected = windowStops.filter((s) => s.timeWindowRespected === true).length;
  const windowScore = windowStops.length === 0 ? 1 : respected / windowStops.length;
  const prioScore = priorityScore(stops);
  const savingsScore = clamp01(savings.distancePct / 25); // 25%+ de economia = nota cheia

  const score = Math.round(100 * (0.5 * windowScore + 0.3 * prioScore + 0.2 * savingsScore));

  const parts = [
    `${strategyLabel}: ${stops.length} paradas`,
    `${savings.distancePct >= 0 ? '−' : '+'}${Math.abs(savings.distancePct)}% de distância vs. ordem original`,
  ];
  if (windowStops.length > 0) {
    parts.push(`${respected}/${windowStops.length} janelas respeitadas`);
  }
  parts.push('prioridades mais altas atendidas primeiro');

  return { score, explanation: parts.join('; ') + '.' };
}
