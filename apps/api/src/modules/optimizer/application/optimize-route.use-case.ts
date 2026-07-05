import { Inject, Injectable } from '@nestjs/common';
import type {
  OptimizationStopInput,
  OptimizationStrategyName,
  OriginInput,
  RoutePlan as RoutePlanView,
} from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError, ValidationError } from '../../../shared/kernel/domain-error';
import { GeoPoint } from '../domain/geo-point';
import { priorityWeight, type OptimizationStop } from '../domain/optimization-stop';
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
}

@Injectable()
export class OptimizeRouteUseCase {
  constructor(
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
    @Inject(DISTANCE_PROVIDER) private readonly distance: DistanceProviderPort,
    @Inject(DELIVERY_GATEWAY) private readonly delivery: DeliveryGatewayPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly registry: StrategyRegistry,
  ) {}

  async execute(command: OptimizeRouteCommand): Promise<RoutePlanView> {
    const speed = command.averageSpeedKmh ?? DEFAULT_SPEED_KMH;
    const service = command.serviceTimeMinutes ?? DEFAULT_SERVICE_MIN;
    if (speed <= 0) throw new ValidationError('Velocidade média deve ser positiva.');
    if (service < 0) throw new ValidationError('Tempo de serviço não pode ser negativo.');

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
          },
          ...rawStops,
        ]
      : rawStops;

    const { distanceMatrix, timeMatrix } = this.buildMatrices(nodes, speed);
    const windows = this.buildWindows(nodes);
    const priorities = nodes.map((n, i) =>
      hasOrigin && i === 0 ? 0 : priorityWeight(n.priority),
    );

    const ctx: StrategyContext = {
      size: nodes.length,
      distanceMatrix,
      timeMatrix,
      priorities,
      windows,
      serviceTimeMinutes: service,
      hasOrigin,
      weights: WEIGHTS,
    };

    const strategy = this.registry.get(command.strategy);
    const { order } = strategy.optimize(ctx);
    const baselineOrder = nodes.map((_, i) => i);

    const optimized = computeMetrics(order, distanceMatrix, timeMatrix, service, hasOrigin);
    const baseline = computeMetrics(baselineOrder, distanceMatrix, timeMatrix, service, hasOrigin);

    const scoringNodes: ScoringNode[] = nodes.map((n, i) => ({
      id: n.id,
      latitude: n.point.latitude,
      longitude: n.point.longitude,
      priority: n.priority,
      window: windows[i],
    }));
    const stops = buildStops(order, scoringNodes, distanceMatrix, timeMatrix, service, hasOrigin);
    const savings = computeSavings(baseline, optimized);
    const { score, explanation } = computeScore(stops, savings, 'Nearest Neighbor + 2-opt');

    const plan = RoutePlan.create({
      tenantId: command.tenantId,
      strategy: strategy.name,
      status: 'completed',
      params: { averageSpeedKmh: speed, serviceTimeMinutes: service, hasOrigin },
      stops,
      metrics: optimized,
      baseline,
      savings,
      score,
      explanation,
    });
    await this.plans.save(plan);

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'route.optimized',
      resource: `route-plan:${plan.id}`,
      metadata: { stops: stops.length, score, strategy: strategy.name },
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
      return found.map((f) => ({
        id: f.id,
        point: GeoPoint.create(f.latitude, f.longitude),
        priority: f.priority,
        timeWindow: f.timeWindow
          ? { start: new Date(f.timeWindow.start), end: new Date(f.timeWindow.end) }
          : null,
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
