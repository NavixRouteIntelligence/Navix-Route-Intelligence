import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPriority } from '@navix/contracts';

import { GeoPoint } from '../domain/geo-point';
import { priorityWeight } from '../domain/optimization-stop';
import {
  DISTANCE_PROVIDER,
  type DistanceProviderPort,
} from '../domain/ports/distance-provider.port';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import type { OptimizationWeights } from '../domain/ports/route-optimization-strategy.port';
import { computeMetrics, computeSavings } from './scoring';
import { OptimizeRouteUseCase } from './optimize-route.use-case';
import { StrategyRegistry } from './strategy-registry';

export interface EstimateInput {
  latitude: number;
  longitude: number;
  priority?: DeliveryPriority;
}
export interface EstimateOutput {
  savingsKm: number;
  savingsPct: number;
}

/** API pública do Optimizer para outros módulos (ex.: Import Center). */
export interface OptimizerServicePort {
  estimate(stops: EstimateInput[]): Promise<EstimateOutput>;
  optimizeDeliveries(tenantId: string, actorId: string, deliveryIds: string[]): Promise<string>;
  /**
   * Chegada estimada da entrega segundo o plano de rota vigente, ou `null` se
   * não houver plano que a contenha.
   *
   * **Heurística** (ADR-0082): `plano.criadoEm + etaMinutes da parada`. Trata o
   * plano como se a rota começasse no instante em que foi calculada — não
   * considera atraso acumulado nem trânsito. Serve para dar ordem de grandeza
   * ao destinatário; o modelo real é a Fase 3 do roadmap.
   */
  etaForDelivery(tenantId: string, deliveryId: string): Promise<Date | null>;
}

export const OPTIMIZER_SERVICE = Symbol('OPTIMIZER_SERVICE');

const SPEED_KMH = 30;
const SERVICE_MIN = 5;
const WEIGHTS: OptimizationWeights = { distance: 1, timeWindow: 0.1, priority: 0.05 };

@Injectable()
export class OptimizerService implements OptimizerServicePort {
  constructor(
    @Inject(DISTANCE_PROVIDER) private readonly distance: DistanceProviderPort,
    private readonly registry: StrategyRegistry,
    private readonly optimizeRoute: OptimizeRouteUseCase,
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
  ) {}

  async estimate(stops: EstimateInput[]): Promise<EstimateOutput> {
    if (stops.length < 2) return { savingsKm: 0, savingsPct: 0 };

    const points = stops.map((s) => GeoPoint.create(s.latitude, s.longitude));
    const size = points.length;
    const distanceMatrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const timeMatrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        const km = this.distance.distanceKm(points[i], points[j]);
        distanceMatrix[i][j] = distanceMatrix[j][i] = km;
        timeMatrix[i][j] = timeMatrix[j][i] = (km / SPEED_KMH) * 60;
      }
    }

    const priorities = stops.map((s) => priorityWeight(s.priority ?? 'normal'));
    const windows = stops.map(() => null);
    const { order } = this.registry.get().optimize({
      size,
      distanceMatrix,
      timeMatrix,
      priorities,
      windows,
      serviceTimeMinutes: SERVICE_MIN,
      hasOrigin: false,
      weights: WEIGHTS,
    });

    const baselineOrder = stops.map((_, i) => i);
    const optimized = computeMetrics(order, distanceMatrix, timeMatrix, SERVICE_MIN, false);
    const baseline = computeMetrics(baselineOrder, distanceMatrix, timeMatrix, SERVICE_MIN, false);
    const savings = computeSavings(baseline, optimized);
    return { savingsKm: savings.distanceKm, savingsPct: savings.distancePct };
  }

  async optimizeDeliveries(tenantId: string, actorId: string, deliveryIds: string[]): Promise<string> {
    const view = await this.optimizeRoute.execute({ tenantId, actorId, deliveryIds });
    return view.id;
  }

  async etaForDelivery(tenantId: string, deliveryId: string): Promise<Date | null> {
    // O plano mais recente é a rota vigente (mesma leitura que o app do
    // motorista faz). A busca respeita a RLS: só enxerga planos deste tenant.
    const page = await this.plans.findAll(tenantId, { page: 1, pageSize: 1 });
    const plan = page.items[0];
    if (!plan) return null;

    const stop = plan.snapshot().stops.find((s) => s.deliveryId === deliveryId);
    if (!stop) return null;

    const startedAt = plan.snapshot().createdAt.getTime();
    return new Date(startedAt + stop.etaMinutes * 60_000);
  }
}
