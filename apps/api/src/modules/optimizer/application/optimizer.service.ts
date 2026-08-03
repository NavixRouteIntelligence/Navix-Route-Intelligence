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
import {
  ETA_CORRECTION,
  type EtaCorrectionPort,
} from '../../intelligence/application/eta-correction.service';
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
  /**
   * A mesma previsão, com o plano de onde saiu — para **medir o erro** depois
   * (ADR-0087). Existe separada de `etaForDelivery` porque quem mede precisa
   * saber a origem: sem o `routePlanId` não dá para distinguir uma previsão que
   * envelheceu de outra recém-reotimizada.
   */
  etaPredictionForDelivery(
    tenantId: string,
    deliveryId: string,
  ): Promise<{ routePlanId: string; arrivalAt: Date; correctionMinutes: number } | null>;
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
    @Inject(ETA_CORRECTION) private readonly etaCorrection: EtaCorrectionPort,
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
    const prediction = await this.etaPredictionForDelivery(tenantId, deliveryId);
    return prediction?.arrivalAt ?? null;
  }

  async etaPredictionForDelivery(
    tenantId: string,
    deliveryId: string,
  ): Promise<{ routePlanId: string; arrivalAt: Date; correctionMinutes: number } | null> {
    // O plano que **contém** esta entrega (ADR-0102) — não o mais recente do
    // tenant. Numa frota, o mais recente é a rota de algum motorista, e quase
    // nunca a de quem leva esta entrega: o `find` abaixo não achava a parada e
    // o ETA saía nulo, em silêncio, para todo mundo menos quem otimizou por
    // último. A busca respeita a RLS: só enxerga planos deste tenant.
    const plan = await this.plans.findLatestContainingDelivery(tenantId, deliveryId);
    if (!plan) return null;

    const snapshot = plan.snapshot();
    const stop = snapshot.stops.find((s) => s.deliveryId === deliveryId);
    // Defensivo: o containment já garante a presença, mas um plano gravado com
    // outro formato de `stops` não deve derrubar o rastreio público.
    if (!stop) return null;

    // `departureAt` e não `createdAt` (ADR-0105): `etaMinutes` é medido a
    // partir da **partida**, e planejar às 17h uma rota que só pode começar às
    // 20h fazia o rastreio anunciar a entrega três horas antes do possível.
    const heuristica = new Date(snapshot.departureAt.getTime() + stop.etaMinutes * 60_000);
    // Único ponto onde heurística e modelo se encontram (ADR-0090). Sem modelo
    // treinado a correção é zero e o resultado é idêntico ao anterior — quem
    // consome ETA (rastreio público, avisos, medição) não muda em nada.
    const correctionMinutes = await this.etaCorrection.correctionMinutes(tenantId, heuristica);

    return {
      routePlanId: snapshot.id,
      arrivalAt: new Date(heuristica.getTime() + correctionMinutes * 60_000),
      correctionMinutes,
    };
  }
}
