import { Inject, Injectable } from '@nestjs/common';
import type {
  OptimizationStopInput,
  OptimizationStrategyName,
  OptimizationVehicleInput,
  OriginInput,
  RoutePlan as RoutePlanView,
} from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError, ValidationError } from '../../../shared/kernel/domain-error';
import { assessCapacity, totalDemand } from '../domain/capacity';
import { GeoPoint } from '../domain/geo-point';
import {
  priorityWeight,
  ZERO_DEMAND,
  type OptimizationStop,
} from '../domain/optimization-stop';
import {
  DISTANCE_PROVIDER,
  type DistanceProviderPort,
} from '../domain/ports/distance-provider.port';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import type {
  NodeWindow,
  OptimizationWeights,
  StrategyContext,
} from '../domain/ports/route-optimization-strategy.port';
import { RoutePlan } from '../domain/route-plan';
import { VehicleProfile } from '../domain/vehicle-profile';
import { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import { DELIVERY_GATEWAY, type DeliveryGatewayPort } from './ports/delivery-gateway.port';
import { buildStops, computeMetrics, computeSavings, computeScore, type ScoringNode } from './scoring';
import { toRoutePlanView } from './route-plan.mapper';
import { StrategyRegistry } from './strategy-registry';

const DEFAULT_SPEED_KMH = 30;
const DEFAULT_SERVICE_MIN = 5;
const MAX_STOPS = 500; // guardrail síncrono (ver plano — acima disso, fila assíncrona)

// Pesos da função de custo composta (tunáveis; no futuro, aprendidos por tenant).
const WEIGHTS: OptimizationWeights = { distance: 1, timeWindow: 0.1, priority: 0.05 };

export interface OptimizeRouteCommand {
  tenantId: string;
  actorId: string;
  origin?: OriginInput | null;
  deliveryIds?: string[];
  stops?: OptimizationStopInput[];
  strategy?: OptimizationStrategyName;
  averageSpeedKmh?: number;
  serviceTimeMinutes?: number;
  vehicle?: OptimizationVehicleInput;
}

@Injectable()
export class OptimizeRouteUseCase {
  constructor(
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
    @Inject(DISTANCE_PROVIDER) private readonly distance: DistanceProviderPort,
    @Inject(DELIVERY_GATEWAY) private readonly delivery: DeliveryGatewayPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly registry: StrategyRegistry,
    private readonly metrics: OptimizerMetrics,
  ) {}

  async execute(command: OptimizeRouteCommand): Promise<RoutePlanView> {
    const service = command.serviceTimeMinutes ?? DEFAULT_SERVICE_MIN;
    if (service < 0) throw new ValidationError('Tempo de serviço não pode ser negativo.');

    // Perfil do veículo (ADR-0022): define velocidade/capacidade por tipo; o
    // `averageSpeedKmh` explícito, quando dado, tem precedência sobre o do perfil.
    const profile = VehicleProfile.resolve(command.vehicle, DEFAULT_SPEED_KMH);
    const speed = command.averageSpeedKmh ?? profile.averageSpeedKmh;
    if (speed <= 0) throw new ValidationError('Velocidade média deve ser positiva.');

    const rawStops = await this.resolveStops(command);
    if (rawStops.length < 2) {
      throw new ValidationError('É necessário ao menos 2 paradas para otimizar.');
    }
    if (rawStops.length > MAX_STOPS) {
      throw new ValidationError(`Máximo de ${MAX_STOPS} paradas por otimização síncrona.`);
    }

    const hasOrigin = command.origin != null;
    const nodes: OptimizationStop[] = hasOrigin
      ? [
          {
            id: 'origin',
            point: GeoPoint.create(command.origin!.latitude, command.origin!.longitude),
            priority: 'normal',
            timeWindow: null,
            demand: ZERO_DEMAND,
            serviceTimeMinutes: 0,
          },
          ...rawStops,
        ]
      : rawStops;

    const { distanceMatrix, timeMatrix } = this.buildMatrices(nodes, speed);
    const windows = this.buildWindows(nodes);
    const priorities = nodes.map((n, i) =>
      hasOrigin && i === 0 ? 0 : priorityWeight(n.priority),
    );
    const perNodeServiceMinutes = nodes.map((n) => n.serviceTimeMinutes ?? service);

    const ctx: StrategyContext = {
      size: nodes.length,
      distanceMatrix,
      timeMatrix,
      priorities,
      windows,
      serviceTimeMinutes: service,
      hasOrigin,
      weights: WEIGHTS,
      perNodeServiceMinutes,
    };

    const strategy = this.registry.get(command.strategy);
    const startedAt = process.hrtime.bigint();
    const { order } = strategy.optimize(ctx);
    const solveSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

    const baselineOrder = nodes.map((_, i) => i);

    // Demanda de carga: só materializa nas paradas/métricas quando há demanda
    // real (>0) — mantém a saída idêntica ao legado sem peso/volume.
    const deliveryDemands = nodes
      .filter((_, i) => !(hasOrigin && i === 0))
      .map((n) => n.demand);
    const anyDemand = deliveryDemands.some((d) => d.weightKg > 0 || d.volumeM3 > 0);

    const scoringNodes: ScoringNode[] = nodes.map((n, i) => ({
      id: n.id,
      latitude: n.point.latitude,
      longitude: n.point.longitude,
      priority: n.priority,
      window: windows[i],
      demand: anyDemand && !(hasOrigin && i === 0) ? n.demand : undefined,
      serviceMinutes: n.serviceTimeMinutes,
    }));

    const optimized = computeMetrics(order, distanceMatrix, timeMatrix, service, hasOrigin, scoringNodes);
    const baseline = computeMetrics(baselineOrder, distanceMatrix, timeMatrix, service, hasOrigin, scoringNodes);
    const stops = buildStops(order, scoringNodes, distanceMatrix, timeMatrix, service, hasOrigin);
    const savings = computeSavings(baseline, optimized);

    // Viabilidade de capacidade (independente da ordem numa rota de 1 veículo).
    // Presente quando há veículo com capacidade OU demanda real informada.
    const capacity =
      anyDemand || profile.capacity !== null
        ? assessCapacity(totalDemand(deliveryDemands), profile.capacity)
        : undefined;
    if (capacity && !capacity.feasible) this.metrics.markInfeasible();

    const { score, explanation } = computeScore(stops, savings, 'Nearest Neighbor + 2-opt', capacity);

    const plan = RoutePlan.create({
      tenantId: command.tenantId,
      strategy: strategy.name,
      status: 'completed',
      params: {
        averageSpeedKmh: speed,
        serviceTimeMinutes: service,
        hasOrigin,
        ...(profile.type ? { vehicleType: profile.type } : {}),
        ...(command.vehicle ? { avoidTolls: profile.avoidTolls } : {}),
      },
      stops,
      metrics: optimized,
      baseline,
      savings,
      score,
      explanation,
      ...(capacity ? { capacity } : {}),
    });
    await this.plans.save(plan);
    this.metrics.observeSolve(strategy.name, solveSeconds, stops.length);

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'route.optimized',
      resource: `route-plan:${plan.id}`,
      metadata: {
        stops: stops.length,
        score,
        strategy: strategy.name,
        vehicleType: profile.type ?? null,
        capacityFeasible: capacity?.feasible ?? null,
      },
    });

    return toRoutePlanView(plan);
  }

  private async resolveStops(command: OptimizeRouteCommand): Promise<OptimizationStop[]> {
    const hasIds = (command.deliveryIds?.length ?? 0) > 0;
    const hasInline = (command.stops?.length ?? 0) > 0;
    if (hasIds && hasInline) {
      throw new ValidationError('Forneça "deliveryIds" OU "stops", não ambos.');
    }

    if (hasIds) {
      const ids = command.deliveryIds!;
      const found = await this.delivery.getStops(command.tenantId, ids);
      if (found.length !== ids.length) {
        throw new NotFoundError('Uma ou mais entregas não foram encontradas.');
      }
      // Demanda por entrega ainda não existe no agregado Delivery (evolução do
      // contexto Delivery) — trata-se como zero até lá. Ver ADR-0022.
      return found.map((f) => ({
        id: f.id,
        point: GeoPoint.create(f.latitude, f.longitude),
        priority: f.priority,
        timeWindow: f.timeWindow
          ? { start: new Date(f.timeWindow.start), end: new Date(f.timeWindow.end) }
          : null,
        demand: ZERO_DEMAND,
        serviceTimeMinutes: null,
      }));
    }

    if (hasInline) {
      return command.stops!.map((s) => ({
        id: s.id,
        point: GeoPoint.create(s.latitude, s.longitude),
        priority: s.priority ?? 'normal',
        timeWindow: s.timeWindow
          ? { start: new Date(s.timeWindow.start), end: new Date(s.timeWindow.end) }
          : null,
        demand: { weightKg: s.weightKg ?? 0, volumeM3: s.volumeM3 ?? 0 },
        serviceTimeMinutes: s.serviceTimeMinutes ?? null,
      }));
    }

    throw new ValidationError('Forneça "deliveryIds" ou "stops".');
  }

  private buildMatrices(
    nodes: OptimizationStop[],
    speedKmh: number,
  ): { distanceMatrix: number[][]; timeMatrix: number[][] } {
    const size = nodes.length;
    const distanceMatrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const timeMatrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        const km = this.distance.distanceKm(nodes[i].point, nodes[j].point);
        const minutes = (km / speedKmh) * 60;
        distanceMatrix[i][j] = distanceMatrix[j][i] = km;
        timeMatrix[i][j] = timeMatrix[j][i] = minutes;
      }
    }
    return { distanceMatrix, timeMatrix };
  }

  private buildWindows(nodes: OptimizationStop[]): (NodeWindow | null)[] {
    const starts = nodes
      .map((n) => n.timeWindow?.start.getTime())
      .filter((t): t is number => t !== undefined);
    const departure = starts.length > 0 ? Math.min(...starts) : Date.now();
    return nodes.map((n) =>
      n.timeWindow
        ? {
            startMinutes: (n.timeWindow.start.getTime() - departure) / 60000,
            endMinutes: (n.timeWindow.end.getTime() - departure) / 60000,
          }
        : null,
    );
  }
}
