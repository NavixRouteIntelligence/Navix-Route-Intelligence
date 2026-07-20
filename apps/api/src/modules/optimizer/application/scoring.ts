import type {
  CapacityUsage,
  DeliveryPriority,
  DestinationType,
  RouteMetrics,
  RouteSavings,
  RouteStopView,
} from '@navix/contracts';

import type { NodeWindow } from '../domain/ports/route-optimization-strategy.port';
import { priorityWeight, type Demand } from '../domain/optimization-stop';

export interface ScoringNode {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  window: NodeWindow | null;
  /** Demanda da parada (ADR-0022). Ausente ⇒ tratada como zero e omitida da view. */
  demand?: Demand;
  /** Tempo de serviço específico do nó (min); null/ausente usa o global. */
  serviceMinutes?: number | null;
  /** Parada travada pela ordem manual (ADR-0063). Reflete na view. */
  locked?: boolean;
  /** Tipo do destino (ADR-0064). Reflete na view. */
  destinationType?: DestinationType;
}

/** Tempo de serviço efetivo do nó: o específico, se houver; senão o global. */
function serviceOf(node: ScoringNode | undefined, globalService: number): number {
  const s = node?.serviceMinutes;
  return s === undefined || s === null ? globalService : s;
}

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Métricas agregadas de uma ordenação de nós.
 * Com `nodes`, usa tempo de serviço por nó e soma peso/volume transportados. */
export function computeMetrics(
  order: number[],
  distance: number[][],
  time: number[][],
  serviceMinutes: number,
  hasOrigin: boolean,
  nodes?: ScoringNode[],
): RouteMetrics {
  let totalDistance = 0;
  let travelTime = 0;
  for (let i = 1; i < order.length; i++) {
    totalDistance += distance[order[i - 1]][order[i]];
    travelTime += time[order[i - 1]][order[i]];
  }

  let serviceTotal = 0;
  let totalWeight = 0;
  let totalVolume = 0;
  let hasDemand = false;
  for (let i = hasOrigin ? 1 : 0; i < order.length; i++) {
    const node = nodes?.[order[i]];
    serviceTotal += serviceOf(node, serviceMinutes);
    if (node?.demand) {
      hasDemand = true;
      totalWeight += node.demand.weightKg;
      totalVolume += node.demand.volumeM3;
    }
  }

  const deliveryStops = hasOrigin ? order.length - 1 : order.length;
  const metrics: RouteMetrics = {
    totalDistanceKm: round(totalDistance),
    totalTimeMinutes: round(travelTime + serviceTotal),
    stops: deliveryStops,
  };
  if (hasDemand) {
    metrics.totalWeightKg = round(totalWeight);
    metrics.totalVolumeM3 = round(totalVolume);
  }
  return metrics;
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
      const view: RouteStopView = {
        sequence,
        deliveryId: n.id,
        latitude: n.latitude,
        longitude: n.longitude,
        priority: n.priority,
        legDistanceKm: round(leg),
        cumulativeDistanceKm: round(cumulativeDistance),
        etaMinutes: round(clock, 1),
        timeWindowRespected: respected,
      };
      if (n.demand) {
        view.weightKg = round(n.demand.weightKg);
        view.volumeM3 = round(n.demand.volumeM3);
      }
      if (n.locked) view.locked = true;
      if (n.destinationType) view.destinationType = n.destinationType;
      views.push(view);
      clock += serviceOf(n, serviceMinutes); // tempo de serviço na parada (por nó)
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
  capacity?: CapacityUsage,
): ScoreResult {
  const windowStops = stops.filter((s) => s.timeWindowRespected !== null);
  const respected = windowStops.filter((s) => s.timeWindowRespected === true).length;
  const windowScore = windowStops.length === 0 ? 1 : respected / windowStops.length;
  const prioScore = priorityScore(stops);
  const savingsScore = clamp01(savings.distancePct / 25); // 25%+ de economia = nota cheia

  let score = Math.round(100 * (0.5 * windowScore + 0.3 * prioScore + 0.2 * savingsScore));
  // Capacidade excedida é penalizada no score (rota inviável para o veículo).
  if (capacity && !capacity.feasible) score = Math.round(score * 0.5);

  const parts = [
    `${strategyLabel}: ${stops.length} paradas`,
    `${savings.distancePct >= 0 ? '−' : '+'}${Math.abs(savings.distancePct)}% de distância vs. ordem original`,
  ];
  if (windowStops.length > 0) {
    parts.push(`${respected}/${windowStops.length} janelas respeitadas`);
  }
  parts.push('prioridades mais altas atendidas primeiro');
  if (capacity) {
    parts.push(
      capacity.feasible
        ? 'capacidade do veículo respeitada'
        : `capacidade excedida (+${capacity.overWeightKg}kg / +${capacity.overVolumeM3}m³)`,
    );
  }

  return { score: Math.max(0, score), explanation: parts.join('; ') + '.' };
}
