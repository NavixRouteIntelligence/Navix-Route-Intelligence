/**
 * Contratos do contexto Optimizer (Route Optimizer). MVP heurístico, sem ML.
 * Ver docs/reviews/phase-1-optimizer-plan.md.
 */
import type { DeliveryPriority, TimeWindow } from './delivery';

export type OptimizationStrategyName = 'nearest-neighbor-2opt';

export const OPTIMIZATION_STRATEGIES: readonly OptimizationStrategyName[] = [
  'nearest-neighbor-2opt',
];

export interface OriginInput {
  latitude: number;
  longitude: number;
}

/** Parada informada inline (alternativa a `deliveryIds`). */
export interface OptimizationStopInput {
  id: string;
  latitude: number;
  longitude: number;
  priority?: DeliveryPriority;
  timeWindow?: TimeWindow | null;
}

export interface OptimizeRouteRequest {
  /** Origem/depósito opcional; se ausente, a rota começa na primeira parada. */
  origin?: OriginInput | null;
  /** Fonte A: IDs de entregas existentes (buscadas no módulo Delivery). */
  deliveryIds?: string[];
  /** Fonte B: paradas inline. Use uma das duas fontes. */
  stops?: OptimizationStopInput[];
  strategy?: OptimizationStrategyName;
  averageSpeedKmh?: number;
  serviceTimeMinutes?: number;
}

export interface RouteStopView {
  sequence: number;
  deliveryId: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
  etaMinutes: number;
  /** null quando a parada não tem janela informada. */
  timeWindowRespected: boolean | null;
}

export interface RouteMetrics {
  totalDistanceKm: number;
  totalTimeMinutes: number;
  stops: number;
}

export interface RouteSavings {
  distanceKm: number;
  timeMinutes: number;
  distancePct: number;
  timePct: number;
}

export interface RoutePlanParams {
  averageSpeedKmh: number;
  serviceTimeMinutes: number;
  hasOrigin: boolean;
}

export interface RoutePlan {
  id: string;
  tenantId: string;
  strategy: OptimizationStrategyName;
  status: 'completed';
  params: RoutePlanParams;
  stops: RouteStopView[];
  metrics: RouteMetrics;
  baseline: RouteMetrics;
  savings: RouteSavings;
  /** Score da rota, 0–100. */
  score: number;
  explanation: string;
  createdAt: string;
}
