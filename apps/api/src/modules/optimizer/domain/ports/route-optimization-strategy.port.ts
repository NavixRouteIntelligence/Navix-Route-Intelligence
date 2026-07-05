import type { OptimizationStrategyName } from '@navix/contracts';

export interface OptimizationWeights {
  distance: number;
  timeWindow: number;
  priority: number;
}

/** Janela por nó, já em minutos relativos ao horário de partida. */
export interface NodeWindow {
  startMinutes: number;
  endMinutes: number;
}

/**
 * Contexto passado à estratégia. Contém tudo o que ela precisa para computar o
 * custo de qualquer ordenação — mas nada de framework/persistência.
 *   - node 0 é a origem (depósito) quando `hasOrigin` é true.
 *   - a rota é um CAMINHO aberto (não retorna à origem).
 */
export interface StrategyContext {
  size: number;
  distanceMatrix: number[][]; // km
  timeMatrix: number[][]; // minutos (deslocamento)
  priorities: number[]; // peso por nó
  windows: (NodeWindow | null)[];
  serviceTimeMinutes: number;
  hasOrigin: boolean;
  weights: OptimizationWeights;
}

export interface StrategyResult {
  /** Ordem de índices dos nós (inclui a origem em primeiro, se houver). */
  order: number[];
}

/**
 * Strategy Pattern: contrato de um algoritmo de otimização. Novas estratégias
 * (OR-Tools, metaheurísticas, IA) implementam esta interface sem alterar a API
 * nem o domínio (ver ADR-0007).
 */
export interface RouteOptimizationStrategy {
  readonly name: OptimizationStrategyName;
  optimize(ctx: StrategyContext): StrategyResult;
}

export const OPTIMIZATION_STRATEGIES = Symbol('OPTIMIZATION_STRATEGIES');
