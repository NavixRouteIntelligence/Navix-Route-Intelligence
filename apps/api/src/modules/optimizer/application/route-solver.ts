import { Inject, Injectable } from '@nestjs/common';
import type {
  CapacityUsage,
  OptimizationStrategyName,
  RouteMetrics,
  RouteSavings,
  RouteStopView,
} from '@navix/contracts';

import { assessCapacity, totalDemand } from '../domain/capacity';
import { type Demand, type OptimizationStop } from '../domain/optimization-stop';
import { slaPriorityWeight } from '../domain/sla-priority';
import {
  COST_AUGMENTATION,
  type CostAugmentationPort,
} from '../domain/ports/cost-augmentation.port';
import {
  DISTANCE_PROVIDER,
  type DistanceProviderPort,
} from '../domain/ports/distance-provider.port';
import type {
  NodeWindow,
  OptimizationWeights,
  StrategyContext,
} from '../domain/ports/route-optimization-strategy.port';
import type { VehicleProfile } from '../domain/vehicle-profile';
import { buildStops, computeMetrics, computeSavings, computeScore, type ScoringNode } from './scoring';
import { StrategyRegistry } from './strategy-registry';

// Pesos da função de custo composta (tunáveis; no futuro, aprendidos por tenant).
const WEIGHTS: OptimizationWeights = { distance: 1, timeWindow: 0.1, priority: 0.05 };

export interface SolveInput {
  /** Nós a otimizar; o índice 0 é a origem quando `hasOrigin`. */
  nodes: OptimizationStop[];
  hasOrigin: boolean;
  speed: number;
  service: number;
  profile: VehicleProfile;
  strategyName?: OptimizationStrategyName;
  strategyLabel?: string;
  /** Pesos da função de custo (Modo Economia — ADR-0026). Default: balanceado. */
  weights?: OptimizationWeights;
}

export interface SolvedRoute {
  strategyName: OptimizationStrategyName;
  stops: RouteStopView[];
  metrics: RouteMetrics;
  baseline: RouteMetrics;
  savings: RouteSavings;
  score: number;
  explanation: string;
  capacity?: CapacityUsage;
  solveSeconds: number;
}

/**
 * Resolve **uma** rota (caminho aberto, 1 veículo): monta as matrizes, invoca a
 * estratégia (Strategy Pattern), pontua e avalia a capacidade. Extraído do
 * `OptimizeRouteUseCase` para ser **reutilizado por rota** na roteirização
 * multi-veículo (ADR-0022, Fase 2) — mesma semântica em ambos os caminhos.
 */
@Injectable()
export class RouteSolver {
  constructor(
    @Inject(DISTANCE_PROVIDER) private readonly distance: DistanceProviderPort,
    @Inject(COST_AUGMENTATION) private readonly augmentation: CostAugmentationPort,
    private readonly registry: StrategyRegistry,
  ) {}

  solve(input: SolveInput): SolvedRoute {
    const { nodes, hasOrigin, speed, service, profile } = input;
    const { distanceMatrix, timeMatrix } = this.buildMatrices(nodes, speed);
    const windows = this.buildWindows(nodes);
    // Priorização dinâmica por SLA: o peso cresce conforme o fim da janela se
    // aproxima (ADR-0022 Fase 3). Sem janela, é o peso base (retrocompatível).
    const priorities = nodes.map((n, i) =>
      hasOrigin && i === 0 ? 0 : slaPriorityWeight(n.priority, windows[i]?.endMinutes ?? null),
    );
    const perNodeServiceMinutes = nodes.map((n) => n.serviceTimeMinutes ?? service);

    // Sobretaxas de pedágio/zona de risco (ADR-0024). No-op por padrão.
    const { edgeSurcharge, nodeSurcharge } = this.augmentation.augment({
      points: nodes.map((n) => ({ latitude: n.point.latitude, longitude: n.point.longitude })),
      avoidTolls: profile.avoidTolls,
    });

    const ctx: StrategyContext = {
      size: nodes.length,
      distanceMatrix,
      timeMatrix,
      priorities,
      windows,
      serviceTimeMinutes: service,
      hasOrigin,
      weights: input.weights ?? WEIGHTS,
      perNodeServiceMinutes,
      ...(edgeSurcharge ? { edgeSurcharge } : {}),
      ...(nodeSurcharge ? { nodeSurcharge } : {}),
    };

    const strategy = this.registry.get(input.strategyName);
    const startedAt = process.hrtime.bigint();
    const { order } = strategy.optimize(ctx);
    const solveSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

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
    const baselineOrder = nodes.map((_, i) => i);

    const optimized = computeMetrics(order, distanceMatrix, timeMatrix, service, hasOrigin, scoringNodes);
    const baseline = computeMetrics(baselineOrder, distanceMatrix, timeMatrix, service, hasOrigin, scoringNodes);
    const stops = buildStops(order, scoringNodes, distanceMatrix, timeMatrix, service, hasOrigin);
    const savings = computeSavings(baseline, optimized);

    const capacity =
      anyDemand || profile.capacity !== null
        ? assessCapacity(totalDemand(deliveryDemands), profile.capacity)
        : undefined;

    const { score, explanation } = computeScore(
      stops,
      savings,
      input.strategyLabel ?? 'Nearest Neighbor + 2-opt',
      capacity,
    );

    return {
      strategyName: strategy.name,
      stops,
      metrics: optimized,
      baseline,
      savings,
      score,
      explanation,
      capacity,
      solveSeconds,
    };
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

/** Reexport util para o caso multi-veículo agregar demanda por parada. */
export type { Demand };
