import type { StrategyContext } from './ports/route-optimization-strategy.port';
import { compositeCost } from './route-cost-model';

/**
 * Buscas locais reutilizáveis por qualquer estratégia (ADR-0024). Operam sobre
 * uma ordenação de nós usando o **custo composto compartilhado** (`compositeCost`),
 * garantindo semântica idêntica entre algoritmos. O nó 0 (origem) é fixo quando
 * `ctx.hasOrigin`. Todas respeitam um `deadline` (orçamento de tempo).
 */

/**
 * Ordem inicial da otimização. Com travas (ADR-0063), parte da **identidade**
 * (a ordem enviada), onde cada nó travado já está na sua posição-âncora; sem
 * travas, usa a construção gulosa Nearest Neighbor (comportamento legado).
 */
export function initialOrder(ctx: StrategyContext): number[] {
  if (ctx.locked?.some(Boolean)) {
    return Array.from({ length: ctx.size }, (_, i) => i);
  }
  return nearestNeighbor(ctx);
}

/**
 * Uma ordenação preserva as travas quando cada nó travado `k` permanece na sua
 * posição-âncora `k` (a ordem parte da identidade). Guard simples e universal:
 * vale para qualquer vizinhança (2-opt, Or-opt) sem lógica específica de move.
 */
export function preservesLocks(order: number[], locked?: boolean[]): boolean {
  if (!locked) return true;
  for (let k = 0; k < order.length; k++) {
    if (locked[k] && order[k] !== k) return false;
  }
  return true;
}

/** Construção gulosa por vizinho mais próximo (distância). */
export function nearestNeighbor(ctx: StrategyContext): number[] {
  const { size, distanceMatrix } = ctx;
  const visited = new Array<boolean>(size).fill(false);
  const order = [0];
  visited[0] = true;
  let last = 0;
  for (let k = 1; k < size; k++) {
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < size; j++) {
      if (!visited[j] && distanceMatrix[last][j] < bestDist) {
        bestDist = distanceMatrix[last][j];
        best = j;
      }
    }
    order.push(best);
    visited[best] = true;
    last = best;
  }
  return order;
}

/** Melhoria 2-opt (inverte segmentos) até ótimo local ou `deadline`. */
export function twoOptImprove(ctx: StrategyContext, initial: number[], deadline: number): number[] {
  let best = initial.slice();
  let bestCost = compositeCost(ctx, best);
  const n = best.length;
  let improved = true;

  while (improved && Date.now() < deadline) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      // nunca inverte a partir do primeiro nó (origem/âncora)
      for (let j = i + 1; j < n; j++) {
        const candidate = reverseSegment(best, i, j);
        // Com travas: descarta inversões que deslocariam uma parada fixada.
        if (!preservesLocks(candidate, ctx.locked)) continue;
        const cost = compositeCost(ctx, candidate);
        if (cost + 1e-9 < bestCost) {
          best = candidate;
          bestCost = cost;
          improved = true;
        }
      }
      if (Date.now() >= deadline) break;
    }
  }
  return best;
}

/**
 * Melhoria Or-opt: reposiciona segmentos curtos (1..`maxSeg` nós) para outro
 * ponto da rota. Captura melhorias que o 2-opt não alcança (mover uma parada
 * "fora do caminho" para junto de vizinhos), sem inverter grandes trechos.
 */
export function orOptImprove(
  ctx: StrategyContext,
  initial: number[],
  deadline: number,
  maxSeg = 3,
): number[] {
  let best = initial.slice();
  let bestCost = compositeCost(ctx, best);
  const start = ctx.hasOrigin ? 1 : 0;
  let improved = true;

  while (improved && Date.now() < deadline) {
    improved = false;
    for (let segLen = 1; segLen <= maxSeg && !improved; segLen++) {
      for (let i = start; i + segLen <= best.length && !improved; i++) {
        const seg = best.slice(i, i + segLen);
        const rest = [...best.slice(0, i), ...best.slice(i + segLen)];
        for (let j = start; j <= rest.length; j++) {
          if (j === i) continue; // mesma posição de origem do segmento
          const candidate = [...rest.slice(0, j), ...seg, ...rest.slice(j)];
          // Com travas: só aceita reposicionamentos que preservam as âncoras.
          if (!preservesLocks(candidate, ctx.locked)) continue;
          const cost = compositeCost(ctx, candidate);
          if (cost + 1e-9 < bestCost) {
            best = candidate;
            bestCost = cost;
            improved = true;
            break;
          }
        }
        if (Date.now() >= deadline) return best;
      }
    }
  }
  return best;
}

function reverseSegment(order: number[], i: number, j: number): number[] {
  return [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
}
