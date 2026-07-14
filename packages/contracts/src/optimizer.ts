/**
 * Contratos do contexto Optimizer (Route Optimizer). MVP heurístico, sem ML.
 * Ver docs/reviews/phase-1-optimizer-plan.md e ADR-0022 (restrições ricas).
 */
import type { VehicleType } from './fleet';
import type { DeliveryPriority, TimeWindow } from './delivery';

export type OptimizationStrategyName = 'nearest-neighbor-2opt' | 'or-opt-2opt';

export const OPTIMIZATION_STRATEGIES: readonly OptimizationStrategyName[] = [
  'nearest-neighbor-2opt',
  // Metaheurística mais forte (VND: Or-opt + 2-opt) — melhor qualidade, mesmo
  // contrato (ADR-0024). Um adaptador OR-Tools nativo entraria pela mesma port.
  'or-opt-2opt',
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
  /** Demanda de carga da parada, em kg (ADR-0022). Default 0. */
  weightKg?: number;
  /** Demanda de volume da parada, em m³ (ADR-0022). Default 0. */
  volumeM3?: number;
  /** Tempo de parada/atendimento específico desta parada, em minutos (sobrepõe o global). */
  serviceTimeMinutes?: number;
}

/**
 * Perfil do veículo da rota (ADR-0022). O `type` define capacidades e velocidade
 * padrão por tipo (moto/carro/carrinha/camião); os campos numéricos sobrepõem os
 * defaults. Tudo opcional — sem `vehicle`, o comportamento é o legado.
 */
export interface OptimizationVehicleInput {
  type?: VehicleType;
  /** Sobrepõe a capacidade de peso (kg) do tipo. */
  capacityKg?: number;
  /** Sobrepõe a capacidade de volume (m³) do tipo. */
  capacityVolumeM3?: number;
  /** Preferência por evitar pedágios (quando um provedor de pedágio existir — roadmap). */
  avoidTolls?: boolean;
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
  /** Perfil do veículo único (capacidade/velocidade por tipo). Opcional (ADR-0022). */
  vehicle?: OptimizationVehicleInput;
  /**
   * Frota para **roteirização multi-veículo** (ADR-0022, Fase 2). Quando presente,
   * as paradas são agrupadas por proximidade/capacidade e distribuídas entre os
   * veículos; a resposta traz `routes[]`. Mutuamente exclusivo com `vehicle`.
   */
  vehicles?: OptimizationVehicleInput[];
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
  /** Demanda de peso (kg) da parada. Presente quando informada (ADR-0022). */
  weightKg?: number;
  /** Demanda de volume (m³) da parada. Presente quando informada (ADR-0022). */
  volumeM3?: number;
}

export interface RouteMetrics {
  totalDistanceKm: number;
  totalTimeMinutes: number;
  stops: number;
  /** Peso total transportado (kg). Presente quando há demanda informada (ADR-0022). */
  totalWeightKg?: number;
  /** Volume total transportado (m³). Presente quando há demanda informada (ADR-0022). */
  totalVolumeM3?: number;
}

/** Análise de capacidade da rota vs. o veículo (ADR-0022). */
export interface CapacityUsage {
  /** true se a demanda total cabe no veículo em todas as dimensões. */
  feasible: boolean;
  weightKg: number;
  volumeM3: number;
  capacityKg: number | null;
  capacityVolumeM3: number | null;
  /** Excedente de peso (kg) quando inviável; 0 caso contrário. */
  overWeightKg: number;
  /** Excedente de volume (m³) quando inviável; 0 caso contrário. */
  overVolumeM3: number;
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
  /** Tipo de veículo considerado (ADR-0022). Presente quando informado. */
  vehicleType?: VehicleType;
  /** Preferência de evitar pedágios (ADR-0022). Presente quando informada. */
  avoidTolls?: boolean;
  /** Nº de veículos com rota atribuída (ADR-0022, Fase 2). Presente no multi-veículo. */
  vehicleCount?: number;
  /** Nº de paradas não atribuídas por falta de capacidade (ADR-0022, Fase 2). */
  unassignedCount?: number;
}

/** Rota de um veículo dentro de um plano multi-veículo (ADR-0022, Fase 2). */
export interface VehicleRouteView {
  /** Índice do veículo na frota informada (0-based). */
  vehicleIndex: number;
  vehicleType?: VehicleType;
  stops: RouteStopView[];
  metrics: RouteMetrics;
  capacity?: CapacityUsage;
}

export interface RoutePlan {
  id: string;
  tenantId: string;
  strategy: OptimizationStrategyName;
  status: 'completed';
  params: RoutePlanParams;
  /** Paradas na ordem final. Em plano multi-veículo, é a concatenação de `routes`. */
  stops: RouteStopView[];
  /** Métricas agregadas (soma entre veículos, no caso multi-veículo). */
  metrics: RouteMetrics;
  baseline: RouteMetrics;
  savings: RouteSavings;
  /** Score da rota, 0–100. */
  score: number;
  explanation: string;
  /** Uso de capacidade vs. o veículo (ADR-0022). Presente quando há veículo/demanda. */
  capacity?: CapacityUsage;
  /** Rotas por veículo (ADR-0022, Fase 2). Presente quando `vehicles` foi informado. */
  routes?: VehicleRouteView[];
  /** IDs de paradas que não couberam em nenhum veículo (frota insuficiente). */
  unassignedStops?: string[];
  createdAt: string;
}

// ===========================================================================
// Otimização assíncrona por Jobs (ADR-0007). O POST enfileira e responde 202;
// o cliente acompanha por polling (GET .../jobs/:jobId) — e, futuramente, por
// WebSocket. Ver docs/api.md §5.1.
// ===========================================================================

export type OptimizationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Recurso de job de otimização. */
export interface OptimizationJob {
  jobId: string;
  status: OptimizationJobStatus;
  /** ID do Route Plan resultante — preenchido quando `succeeded`. */
  routePlanId: string | null;
  /** Mensagem de erro — preenchida quando `failed`. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Resposta `202 Accepted` do enfileiramento da otimização. */
export interface OptimizationJobAccepted {
  jobId: string;
  status: OptimizationJobStatus;
}
