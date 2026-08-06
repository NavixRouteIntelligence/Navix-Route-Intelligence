import { Inject, Injectable } from '@nestjs/common';
import type {
  CapacityUsage,
  OptimizationStrategyName,
  RouteMetrics,
  RouteSavings,
  RouteStopView,
} from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { assessCapacity, totalDemand } from '../domain/capacity';
import { serviceMinutesForDestination } from '../domain/destination-type';
import { type Demand, type OptimizationStop } from '../domain/optimization-stop';
import { analyzeReachability, hasUnreachableLeg } from '../domain/reachability';
import { slaPriorityWeight } from '../domain/sla-priority';
import {
  COST_AUGMENTATION,
  type CostAugmentationPort,
} from '../domain/ports/cost-augmentation.port';
import {
  ROUTING_PROVIDER,
  type RoutingProviderPort,
  type RoutingProfileMapping,
  type RoutingSource,
} from '../domain/ports/routing-provider.port';
import type {
  NodeWindow,
  OptimizationWeights,
  StrategyContext,
} from '../domain/ports/route-optimization-strategy.port';
import type { VehicleProfile } from '../domain/vehicle-profile';
import {
  buildStops,
  computeMetrics,
  computeSavings,
  computeScore,
  type ScoringNode,
} from './scoring';
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
  /**
   * Instante da partida — o minuto zero de `etaMinutes` (ADR-0105). Quem chama
   * informa; o solver não inventa mais uma âncora que só ele conhece.
   */
  departureAt: Date;
  /** Paradas sem peso/volume informados, para a explicação (ADR-0109). */
  stopsWithoutDemand?: number;
  /** Paradas cortadas por capacidade, para a explicação (ADR-0109). */
  unassignedByCapacity?: number;
}

/** Parada deixada de fora por não haver rota até ela (ADR-0106). */
export interface UnreachableStop {
  id: string;
  reason: 'isolated' | 'disconnected';
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
  /** Paradas fora da rota por falta de trecho viável. Vazio no caso normal. */
  unreachable: UnreachableStop[];
  /** De onde vieram distância e duração (ADR-0107). */
  routingSource: RoutingSource;
  /** Perfil de deslocamento usado, e sua fidelidade ao veículo (ADR-0108). */
  routingProfile?: RoutingProfileMapping;
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
    @Inject(ROUTING_PROVIDER) private readonly routing: RoutingProviderPort,
    @Inject(COST_AUGMENTATION) private readonly augmentation: CostAugmentationPort,
    private readonly registry: StrategyRegistry,
  ) {}

  async solve(input: SolveInput): Promise<SolvedRoute> {
    const { hasOrigin, speed, service, profile } = input;
    const matriz = await this.routing.matrix(
      input.nodes.map((n) => n.point),
      speed,
      // O perfil do provedor sai do tipo do veículo (ADR-0108): sem isto, uma
      // bicicleta recebia distâncias de carro, por vias onde não circula.
      profile.type,
    );

    // Trechos sem rota viram exclusão explícita, não custo zero (ADR-0106).
    const { nodes, distanceMatrix, timeMatrix, unreachable } = this.dropUnreachable(
      input.nodes,
      matriz,
      hasOrigin,
    );
    const windows = this.buildWindows(nodes, input.departureAt);
    // Priorização dinâmica por SLA: o peso cresce conforme o fim da janela se
    // aproxima (ADR-0022 Fase 3). Sem janela, é o peso base (retrocompatível).
    const priorities = nodes.map((n, i) =>
      hasOrigin && i === 0 ? 0 : slaPriorityWeight(n.priority, windows[i]?.endMinutes ?? null),
    );
    // Tempo de serviço efetivo por nó: explícito da parada, senão o histórico
    // observado (Inteligência Coletiva, ADR-0065), senão o default por tipo de
    // destino (ADR-0064), senão o global. Dado real vence heurística.
    const effectiveService = (n: OptimizationStop): number =>
      n.serviceTimeMinutes ??
      n.historicalServiceMinutes ??
      serviceMinutesForDestination(n.destinationType) ??
      service;
    const perNodeServiceMinutes = nodes.map(effectiveService);

    // Sobretaxas de pedágio/zona de risco (ADR-0024). No-op por padrão.
    const { edgeSurcharge, nodeSurcharge } = this.augmentation.augment({
      points: nodes.map((n) => ({ latitude: n.point.latitude, longitude: n.point.longitude })),
      avoidTolls: profile.avoidTolls,
    });

    // Travas de posição (ADR-0063): a origem (nó 0) nunca trava. Só entra no ctx
    // se houver ao menos uma — mantém o caminho sem-trava idêntico ao legado.
    const locked = nodes.map((n, i) => (hasOrigin && i === 0 ? false : (n.locked ?? false)));
    const hasLocks = locked.some(Boolean);

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
      ...(hasLocks ? { locked } : {}),
    };

    const strategy = this.registry.get(input.strategyName);
    const startedAt = process.hrtime.bigint();
    const { order } = strategy.optimize(ctx);
    const solveSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

    const deliveryDemands = nodes.filter((_, i) => !(hasOrigin && i === 0)).map((n) => n.demand);
    const anyDemand = deliveryDemands.some((d) => d.weightKg > 0 || d.volumeM3 > 0);

    const scoringNodes: ScoringNode[] = nodes.map((n, i) => ({
      id: n.id,
      latitude: n.point.latitude,
      longitude: n.point.longitude,
      priority: n.priority,
      window: windows[i],
      demand: anyDemand && !(hasOrigin && i === 0) ? n.demand : undefined,
      // Serviço efetivo (inclui o default por tipo) para métricas/ETA coerentes.
      serviceMinutes: hasOrigin && i === 0 ? n.serviceTimeMinutes : effectiveService(n),
      ...(n.locked ? { locked: true } : {}),
      ...(n.destinationType ? { destinationType: n.destinationType } : {}),
    }));
    const baselineOrder = nodes.map((_, i) => i);

    const optimized = computeMetrics(
      order,
      distanceMatrix,
      timeMatrix,
      service,
      hasOrigin,
      scoringNodes,
    );
    const baseline = computeMetrics(
      baselineOrder,
      distanceMatrix,
      timeMatrix,
      service,
      hasOrigin,
      scoringNodes,
    );
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
      unreachable.length,
      matriz.source,
      matriz.profile?.caveat,
      input.stopsWithoutDemand,
      input.unassignedByCapacity,
    );

    return {
      strategyName: strategy.name,
      routingSource: matriz.source,
      ...(matriz.profile ? { routingProfile: matriz.profile } : {}),
      unreachable,
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

  /**
   * Remove do grafo o que não tem rota, devolvendo submatrizes reindexadas.
   *
   * A política é **plano parcial com motivo**: a rota cobre o que dá para
   * cobrir e declara o que ficou de fora. Falhar por inteiro puniria a
   * operação por causa de uma coordenada errada numa parada; ajustar em
   * silêncio — que é o que o custo zero fazia — é pior ainda.
   *
   * Só quando o que sobra não forma rota (menos de duas paradas) é que a
   * otimização falha, e falha dizendo por quê.
   */
  private dropUnreachable(
    nodes: OptimizationStop[],
    matriz: { distanceKm: number[][]; durationMin: number[][] },
    hasOrigin: boolean,
  ): {
    nodes: OptimizationStop[];
    distanceMatrix: number[][];
    timeMatrix: number[][];
    unreachable: UnreachableStop[];
  } {
    if (!hasUnreachableLeg(matriz.distanceKm)) {
      return {
        nodes,
        distanceMatrix: matriz.distanceKm,
        timeMatrix: matriz.durationMin,
        unreachable: [],
      };
    }

    const { routable, unreachable } = analyzeReachability(matriz.distanceKm, hasOrigin);
    const paradasRestantes = hasOrigin ? routable.length - 1 : routable.length;
    if (paradasRestantes < 2) {
      throw new ValidationError(
        'Não há rota viável entre as paradas informadas: verifique as coordenadas.',
      );
    }

    const recorte = (m: number[][]): number[][] =>
      routable.map((i) => routable.map((j) => m[i][j]));

    return {
      nodes: routable.map((i) => nodes[i]),
      distanceMatrix: recorte(matriz.distanceKm),
      timeMatrix: recorte(matriz.durationMin),
      unreachable: unreachable.map((u) => ({ id: nodes[u.index].id, reason: u.reason })),
    };
  }

  /**
   * Janelas em minutos relativos à **partida informada** (ADR-0105).
   *
   * Antes a partida era inventada aqui — a abertura de janela mais cedo da
   * rota, ou `Date.now()`. Isso dava um minuto zero que ninguém mais conhecia:
   * quem consumia ETA somava esses minutos ao `createdAt` do plano, e as duas
   * âncoras discordavam sempre que a rota não começava exatamente na abertura
   * da primeira janela.
   */
  private buildWindows(nodes: OptimizationStop[], departureAt: Date): (NodeWindow | null)[] {
    const departure = departureAt.getTime();
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
