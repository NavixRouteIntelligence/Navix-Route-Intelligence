import { Injectable } from '@nestjs/common';
import type { OptimizationStrategyName } from '@navix/contracts';

import { compositeCost } from '../../domain/route-cost-model';
import type {
  RouteOptimizationStrategy,
  StrategyContext,
  StrategyResult,
} from '../../domain/ports/route-optimization-strategy.port';

const TIME_BUDGET_MS = 2000;

/**
 * Nearest Neighbor (construção gulosa) + 2-opt (melhoria) sobre uma função de
 * custo composta = distância + penalidade de janela + penalidade de prioridade.
 * A rota é um caminho aberto; o primeiro nó (origem, quando houver) é fixo.
 * Determinística e sem dependências — ver plano do Optimizer.
 */
@Injectable()
export class NearestNeighbor2OptStrategy implements RouteOptimizationStrategy {
  readonly name: OptimizationStrategyName = 'nearest-neighbor-2opt';

  optimize(ctx: StrategyContext): StrategyResult {
    const initial = this.nearestNeighbor(ctx);
    return { order: this.twoOpt(ctx, initial) };
  }

  private nearestNeighbor(ctx: StrategyContext): number[] {
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

  private twoOpt(ctx: StrategyContext, initial: number[]): number[] {
    let best = initial.slice();
    let bestCost = compositeCost(ctx, best);
    const n = best.length;
    const deadline = Date.now() + TIME_BUDGET_MS;
    let improved = true;

    while (improved && Date.now() < deadline) {
      improved = false;
      for (let i = 1; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
          const candidate = this.reverseSegment(best, i, j);
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

  private reverseSegment(order: number[], i: number, j: number): number[] {
    return [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
  }
}
