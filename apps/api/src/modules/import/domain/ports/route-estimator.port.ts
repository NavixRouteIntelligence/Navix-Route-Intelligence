import type { DeliveryPriority } from '@navix/contracts';

export interface EstimateStop {
  latitude: number;
  longitude: number;
  priority?: DeliveryPriority;
}

export interface RouteEstimate {
  savingsKm: number;
  savingsPct: number;
}

/** Porta anti-corrupção do Import para o contexto Optimizer. */
export interface RouteEstimatorPort {
  /** Estimativa (dry-run, sem persistir) da economia para um conjunto de paradas. */
  estimate(stops: EstimateStop[]): Promise<RouteEstimate>;
  /** Otimiza e persiste um Route Plan para as entregas criadas; retorna o id. */
  optimize(tenantId: string, actorId: string, deliveryIds: string[]): Promise<string>;
}

export const ROUTE_ESTIMATOR = Symbol('ROUTE_ESTIMATOR');
