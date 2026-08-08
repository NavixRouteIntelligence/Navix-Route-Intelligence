import type { OptimizationStrategyName } from '@navix/contracts';

export interface OptimizationWeights {
  distance: number;
  /**
   * Peso da **duração real de viagem** (ADR-0111).
   *
   * Até aqui não existia: o objetivo "menor tempo" apenas reduzia o peso da
   * distância e aumentava o do cumprimento de janela — nunca minimizava tempo.
   * A matriz de duração já vinha do provedor e era usada só para o relógio.
   *
   * Ausente vale zero, o que preserva exatamente o comportamento anterior.
   */
  duration?: number;
  /**
   * Peso do **custo de portagem** por trecho (ADR-0111). Só tem efeito quando
   * há pórticos declarados: sem dados, não há o que pesar, e inventar um valor
   * a partir da distância seria pior que não ter.
   */
  toll?: number;
  timeWindow: number;
  priority: number;
  /**
   * Peso das sobretaxas por aresta/nó (pedágio, zona de risco). Opcional; quando
   * ausente, vale 1. As sobretaxas só entram no custo se `edgeSurcharge`/
   * `nodeSurcharge` forem fornecidos (ADR-0022; provedor de dados é roadmap).
   */
  surcharge?: number;
}

/** Custo de portagem por trecho (ADR-0111). `null` quando não há dados. */
export type TollMatrix = number[][] | null;

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
 *
 * Campos opcionais (ADR-0022) são retrocompatíveis: ausentes, o custo é idêntico
 * ao legado. `perNodeServiceMinutes[i]` sobrepõe `serviceTimeMinutes` no nó `i`;
 * `edgeSurcharge[a][b]`/`nodeSurcharge[i]` modelam pedágio/risco (seam para o
 * provedor de dados da Fase 4).
 */
export interface StrategyContext {
  size: number;
  distanceMatrix: number[][]; // km
  timeMatrix: number[][]; // minutos (deslocamento)
  /**
   * Custo de portagem por trecho (ADR-0111). `undefined` quando não há pórticos
   * declarados — e é diferente de uma matriz de zeros, que afirmaria que a rota
   * não paga portagem nenhuma.
   */
  tollMatrix?: number[][];
  priorities: number[]; // peso por nó
  windows: (NodeWindow | null)[];
  serviceTimeMinutes: number;
  hasOrigin: boolean;
  weights: OptimizationWeights;
  /** Tempo de serviço por nó (min); sobrepõe `serviceTimeMinutes` quando presente. */
  perNodeServiceMinutes?: number[];
  /** Sobretaxa por aresta (ex.: pedágio) somada ao custo ao percorrê-la. */
  edgeSurcharge?: number[][];
  /** Sobretaxa por nó visitado (ex.: zona de risco). */
  nodeSurcharge?: number[];
  /**
   * Travas de posição da ordem manual (ADR-0063). `locked[k] === true` fixa o nó
   * `k` na posição `k` da ordem enviada; as buscas locais só aceitam movimentos
   * que preservam essas posições (reordenam apenas as paradas livres). Ausente ⇒
   * otimização irrestrita (comportamento legado, idêntico byte a byte).
   */
  locked?: boolean[];
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
