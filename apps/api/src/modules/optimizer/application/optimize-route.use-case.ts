import { Inject, Injectable } from '@nestjs/common';
import type {
  EconomyMode,
  OptimizationStopInput,
  OptimizationStrategyName,
  OptimizationVehicleInput,
  OriginInput,
  RouteMetrics,
  RoutePlan as RoutePlanView,
  RouteStopView,
  VehicleRouteView,
  VehicleType,
} from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError, ValidationError } from '../../../shared/kernel/domain-error';
import { estimateCo2Kg, weightsFor } from '../domain/economy';
import { partitionByCapacity } from '../domain/fleet-partitioner';
import { GeoPoint } from '../domain/geo-point';
import { ZERO_DEMAND, type OptimizationStop } from '../domain/optimization-stop';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import { RoutePlan } from '../domain/route-plan';
import { VehicleProfile } from '../domain/vehicle-profile';
import { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import { DELIVERY_GATEWAY, type DeliveryGatewayPort } from './ports/delivery-gateway.port';
import { RouteSolver, type SolvedRoute } from './route-solver';
import { computeSavings } from './scoring';
import { toRoutePlanView } from './route-plan.mapper';

const DEFAULT_SPEED_KMH = 30;
const DEFAULT_SERVICE_MIN = 5;
const MAX_STOPS = 500; // guardrail síncrono (ver plano — acima disso, fila assíncrona)
const MAX_VEHICLES = 50;

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export interface OptimizeRouteCommand {
  tenantId: string;
  actorId: string;
  origin?: OriginInput | null;
  deliveryIds?: string[];
  stops?: OptimizationStopInput[];
  strategy?: OptimizationStrategyName;
  averageSpeedKmh?: number;
  serviceTimeMinutes?: number;
  economyMode?: EconomyMode;
  vehicle?: OptimizationVehicleInput;
  vehicles?: OptimizationVehicleInput[];
}

@Injectable()
export class OptimizeRouteUseCase {
  constructor(
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
    @Inject(DELIVERY_GATEWAY) private readonly delivery: DeliveryGatewayPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly solver: RouteSolver,
    private readonly metrics: OptimizerMetrics,
  ) {}

  async execute(command: OptimizeRouteCommand): Promise<RoutePlanView> {
    const service = command.serviceTimeMinutes ?? DEFAULT_SERVICE_MIN;
    if (service < 0) throw new ValidationError('Tempo de serviço não pode ser negativo.');
    if (command.vehicle && command.vehicles?.length) {
      throw new ValidationError('Forneça "vehicle" (único) OU "vehicles" (frota), não ambos.');
    }

    const rawStops = await this.resolveStops(command);
    if (rawStops.length < 2) {
      throw new ValidationError('É necessário ao menos 2 paradas para otimizar.');
    }
    if (rawStops.length > MAX_STOPS) {
      throw new ValidationError(`Máximo de ${MAX_STOPS} paradas por otimização síncrona.`);
    }

    const plan = command.vehicles?.length
      ? await this.planFleet(command, rawStops, service)
      : await this.planSingle(command, rawStops, service);

    await this.plans.save(plan);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'route.optimized',
      resource: `route-plan:${plan.id}`,
      metadata: {
        stops: plan.snapshot().stops.length,
        score: plan.snapshot().score,
        strategy: plan.snapshot().strategy,
        vehicles: command.vehicles?.length ?? 1,
        unassigned: plan.snapshot().params.unassignedCount ?? 0,
      },
    });
    return toRoutePlanView(plan);
  }

  /** Caminho de veículo único (comportamento legado + ADR-0022 Fase 1). */
  private async planSingle(
    command: OptimizeRouteCommand,
    rawStops: OptimizationStop[],
    service: number,
  ): Promise<RoutePlan> {
    const profile = VehicleProfile.resolve(command.vehicle, DEFAULT_SPEED_KMH);
    const speed = command.averageSpeedKmh ?? profile.averageSpeedKmh;
    if (speed <= 0) throw new ValidationError('Velocidade média deve ser positiva.');

    const hasOrigin = command.origin != null;
    const nodes = this.withOrigin(command.origin, rawStops);
    const solved = await this.solver.solve({
      nodes,
      hasOrigin,
      speed,
      service,
      profile,
      strategyName: command.strategy,
      ...(command.strategy === 'manual' ? { strategyLabel: 'Ordem manual' } : {}),
      weights: weightsFor(command.economyMode),
    });
    this.metrics.observeSolve(solved.strategyName, solved.solveSeconds, solved.stops.length);
    if (solved.capacity && !solved.capacity.feasible) this.metrics.markInfeasible();

    return RoutePlan.create({
      tenantId: command.tenantId,
      strategy: solved.strategyName,
      status: 'completed',
      params: {
        averageSpeedKmh: speed,
        serviceTimeMinutes: service,
        hasOrigin,
        ...(profile.type ? { vehicleType: profile.type } : {}),
        ...(command.vehicle ? { avoidTolls: profile.avoidTolls } : {}),
        ...(command.economyMode ? { economyMode: command.economyMode } : {}),
      },
      stops: solved.stops,
      metrics: this.withCo2(solved.metrics, profile.type, solved.metrics.totalDistanceKm),
      baseline: solved.baseline,
      savings: solved.savings,
      score: solved.score,
      explanation: solved.explanation,
      ...(solved.capacity ? { capacity: solved.capacity } : {}),
    });
  }

  /** Anexa a emissão de CO₂ estimada às métricas quando há tipo de veículo. */
  private withCo2(
    metrics: RouteMetrics,
    vehicleType: VehicleType | null,
    distanceKm: number,
  ): RouteMetrics {
    if (!vehicleType) return metrics;
    return { ...metrics, estimatedCo2Kg: estimateCo2Kg(vehicleType, distanceKm) };
  }

  /** Caminho multi-veículo (ADR-0022 Fase 2): clustering + rota por veículo. */
  private async planFleet(
    command: OptimizeRouteCommand,
    rawStops: OptimizationStop[],
    service: number,
  ): Promise<RoutePlan> {
    const vehicles = command.vehicles!;
    if (vehicles.length > MAX_VEHICLES) {
      throw new ValidationError(`Máximo de ${MAX_VEHICLES} veículos por plano.`);
    }
    const profiles = vehicles.map((v) => VehicleProfile.resolve(v, DEFAULT_SPEED_KMH));
    const origin = command.origin ? GeoPoint.create(command.origin.latitude, command.origin.longitude) : null;
    const hasOrigin = origin != null;

    const partition = partitionByCapacity(
      rawStops.map((s) => ({ point: s.point, demand: s.demand })),
      profiles.map((p) => ({ capacity: p.capacity })),
      origin,
    );

    const routes: VehicleRouteView[] = [];
    const solvedRoutes: SolvedRoute[] = [];
    let strategyName: OptimizationStrategyName = 'nearest-neighbor-2opt';
    for (let v = 0; v < profiles.length; v++) {
      const clusterIdx = partition.clusters[v];
      if (!clusterIdx || clusterIdx.length === 0) continue;

      const profile = profiles[v];
      const speed = command.averageSpeedKmh ?? profile.averageSpeedKmh;
      if (speed <= 0) throw new ValidationError('Velocidade média deve ser positiva.');

      const clusterStops = clusterIdx.map((i) => rawStops[i]);
      const nodes = this.withOrigin(command.origin, clusterStops);
      const solved = await this.solver.solve({
        nodes,
        hasOrigin,
        speed,
        service,
        profile,
        strategyName: command.strategy,
        weights: weightsFor(command.economyMode),
      });
      strategyName = solved.strategyName;
      this.metrics.observeSolve(solved.strategyName, solved.solveSeconds, solved.stops.length);
      if (solved.capacity && !solved.capacity.feasible) this.metrics.markInfeasible();

      solvedRoutes.push(solved);
      routes.push({
        vehicleIndex: v,
        ...(profile.type ? { vehicleType: profile.type } : {}),
        stops: solved.stops,
        metrics: this.withCo2(solved.metrics, profile.type, solved.metrics.totalDistanceKm),
        ...(solved.capacity ? { capacity: solved.capacity } : {}),
      });
    }

    const unassignedStops = partition.unassigned.map((i) => rawStops[i].id);
    if (unassignedStops.length > 0) this.metrics.markInfeasible();

    return this.aggregatePlan(command, service, hasOrigin, routes, solvedRoutes, unassignedStops, strategyName);
  }

  /** Agrega as rotas por veículo em um único RoutePlan (métricas somadas). */
  private aggregatePlan(
    command: OptimizeRouteCommand,
    service: number,
    hasOrigin: boolean,
    routes: VehicleRouteView[],
    solvedRoutes: SolvedRoute[],
    unassignedStops: string[],
    strategyName: OptimizationStrategyName,
  ): RoutePlan {
    let seq = 0;
    const stops: RouteStopView[] = routes.flatMap((r) =>
      r.stops.map((s) => ({ ...s, sequence: ++seq })),
    );

    const metrics = this.sumMetrics(routes.map((r) => r.metrics));
    const baseline = this.sumMetrics(solvedRoutes.map((r) => r.baseline));
    const savings = computeSavings(baseline, metrics);

    const totalStops = stops.length || 1;
    const score = Math.round(
      solvedRoutes.reduce((acc, r) => acc + r.stops.length * r.score, 0) / totalStops,
    );

    const parts = [
      `Frota: ${routes.length} veículo(s), ${stops.length} paradas`,
      `${savings.distancePct >= 0 ? '−' : '+'}${Math.abs(savings.distancePct)}% de distância vs. ordem original`,
      ...(unassignedStops.length > 0
        ? [`${unassignedStops.length} parada(s) não atribuída(s) por capacidade`]
        : []),
    ];

    return RoutePlan.create({
      tenantId: command.tenantId,
      strategy: strategyName,
      status: 'completed',
      params: {
        averageSpeedKmh: command.averageSpeedKmh ?? DEFAULT_SPEED_KMH,
        serviceTimeMinutes: service,
        hasOrigin,
        vehicleCount: routes.length,
        ...(unassignedStops.length > 0 ? { unassignedCount: unassignedStops.length } : {}),
        ...(command.economyMode ? { economyMode: command.economyMode } : {}),
      },
      stops,
      metrics,
      baseline,
      savings,
      score,
      explanation: parts.join('; ') + '.',
      routes,
      ...(unassignedStops.length > 0 ? { unassignedStops } : {}),
    });
  }

  private sumMetrics(list: RouteMetrics[]): RouteMetrics {
    const acc: RouteMetrics = { totalDistanceKm: 0, totalTimeMinutes: 0, stops: 0 };
    let weight = 0;
    let volume = 0;
    let co2 = 0;
    let hasDemand = false;
    let hasCo2 = false;
    for (const m of list) {
      acc.totalDistanceKm += m.totalDistanceKm;
      acc.totalTimeMinutes += m.totalTimeMinutes;
      acc.stops += m.stops;
      if (m.totalWeightKg !== undefined || m.totalVolumeM3 !== undefined) {
        hasDemand = true;
        weight += m.totalWeightKg ?? 0;
        volume += m.totalVolumeM3 ?? 0;
      }
      if (m.estimatedCo2Kg !== undefined) {
        hasCo2 = true;
        co2 += m.estimatedCo2Kg;
      }
    }
    acc.totalDistanceKm = round(acc.totalDistanceKm);
    acc.totalTimeMinutes = round(acc.totalTimeMinutes);
    if (hasDemand) {
      acc.totalWeightKg = round(weight);
      acc.totalVolumeM3 = round(volume);
    }
    if (hasCo2) acc.estimatedCo2Kg = round(co2);
    return acc;
  }

  /** Adiciona (ou não) a origem como primeiro nó. */
  private withOrigin(
    origin: OriginInput | null | undefined,
    stops: OptimizationStop[],
  ): OptimizationStop[] {
    if (!origin) return stops;
    return [
      {
        id: 'origin',
        point: GeoPoint.create(origin.latitude, origin.longitude),
        priority: 'normal',
        timeWindow: null,
        demand: ZERO_DEMAND,
        serviceTimeMinutes: 0,
      },
      ...stops,
    ];
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
        ...(s.locked ? { locked: true } : {}),
      }));
    }

    throw new ValidationError('Forneça "deliveryIds" ou "stops".');
  }
}
