import { Injectable } from '@nestjs/common';
import type { OptimizationStrategyName } from '@navix/contracts';

import { nearestNeighbor, orOptImprove, twoOptImprove } from '../../domain/local-search';
import { compositeCost } from '../../domain/route-cost-model';
import type {
  RouteOptimizationStrategy,
  StrategyContext,
  StrategyResult,
} from '../../domain/ports/route-optimization-strategy.port';

const TIME_BUDGET_MS = 2500;

/**
 * Metaheurística **VND** (Variable Neighborhood Descent): alterna **2-opt** e
 * **Or-opt** até nenhuma vizinhança melhorar (ou esgotar o orçamento de tempo),
 * a partir da construção Nearest Neighbor. Determinística e sem dependências,
 * **nunca pior** que o NN+2-opt (faz 2-opt e ainda o Or-opt por cima).
 *
 * Entra pelo **mesmo Strategy Pattern** — um adaptador para OR-Tools (nativo)
 * seria apenas outra implementação desta port, sem tocar API/domínio (ADR-0024).
 */
@Injectable()
export class OrOpt2OptStrategy implements RouteOptimizationStrategy {
  readonly name: OptimizationStrategyName = 'or-opt-2opt';

  optimize(ctx: StrategyContext): StrategyResult {
    const deadline = Date.now() + TIME_BUDGET_MS;
    let order = nearestNeighbor(ctx);
    let cost = compositeCost(ctx, order);

    let improved = true;
    while (improved && Date.now() < deadline) {
      improved = false;
      const after2opt = twoOptImprove(ctx, order, deadline);
      const afterOrOpt = orOptImprove(ctx, after2opt, deadline);
      const newCost = compositeCost(ctx, afterOrOpt);
      if (newCost + 1e-9 < cost) {
        order = afterOrOpt;
        cost = newCost;
        improved = true;
      }
    }
    return { order };
  }
}
