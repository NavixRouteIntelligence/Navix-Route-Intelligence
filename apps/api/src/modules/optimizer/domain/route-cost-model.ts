import type { StrategyContext } from './ports/route-optimization-strategy.port';

/**
 * Função de custo composta do motor (ADR-0007/0022), extraída para ser
 * **reutilizada por qualquer estratégia** (NN+2-opt hoje; OR-Tools/metaheurística
 * no futuro) — garantindo semântica idêntica de custo entre algoritmos.
 *
 * Custo = distância + penalidade de atraso (janelas) + penalidade de inversão de
 * prioridade + sobretaxas (pedágio/risco). Campos opcionais do contexto ausentes
 * ⇒ resultado idêntico ao legado (retrocompatível).
 *
 * A rota é um caminho aberto; o nó 0 é a origem quando `hasOrigin`.
 */
export function compositeCost(ctx: StrategyContext, order: number[]): number {
  const surchargeWeight = ctx.weights.surcharge ?? 1;

  let distance = 0;
  let surcharge = 0;
  for (let i = 1; i < order.length; i++) {
    const from = order[i - 1];
    const to = order[i];
    distance += ctx.distanceMatrix[from][to];
    if (ctx.edgeSurcharge) surcharge += ctx.edgeSurcharge[from][to];
  }

  let clock = 0;
  let lateness = 0;
  let priorityPenalty = 0;
  let position = 0;
  for (let i = 0; i < order.length; i++) {
    const node = order[i];
    if (i > 0) clock += ctx.timeMatrix[order[i - 1]][node];
    const isOrigin = ctx.hasOrigin && i === 0;
    if (isOrigin) continue;

    const window = ctx.windows[node];
    if (window && clock > window.endMinutes) lateness += clock - window.endMinutes;

    priorityPenalty += ctx.priorities[node] * position;
    position += 1;

    if (ctx.nodeSurcharge) surcharge += ctx.nodeSurcharge[node];
    clock += serviceTimeAt(ctx, node);
  }

  return (
    ctx.weights.distance * distance +
    ctx.weights.timeWindow * lateness +
    ctx.weights.priority * priorityPenalty +
    surchargeWeight * surcharge
  );
}

/** Tempo de serviço no nó: por-nó quando informado, senão o global. */
export function serviceTimeAt(ctx: StrategyContext, node: number): number {
  const perNode = ctx.perNodeServiceMinutes?.[node];
  return perNode ?? ctx.serviceTimeMinutes;
}
