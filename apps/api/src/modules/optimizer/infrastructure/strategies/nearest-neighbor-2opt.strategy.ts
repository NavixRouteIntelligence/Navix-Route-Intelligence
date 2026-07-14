import { Injectable } from '@nestjs/common';
import type { OptimizationStrategyName } from '@navix/contracts';

import { nearestNeighbor, twoOptImprove } from '../../domain/local-search';
import type {
  RouteOptimizationStrategy,
  StrategyContext,
  StrategyResult,
} from '../../domain/ports/route-optimization-strategy.port';

const TIME_BUDGET_MS = 2000;

/**
 * Nearest Neighbor (construção gulosa) + 2-opt (melhoria) sobre a função de
 * custo composta compartilhada (`compositeCost`). Determinística e sem
 * dependências. Estratégia **padrão** (ver ADR-0007/0024).
 */
@Injectable()
export class NearestNeighbor2OptStrategy implements RouteOptimizationStrategy {
  readonly name: OptimizationStrategyName = 'nearest-neighbor-2opt';

  optimize(ctx: StrategyContext): StrategyResult {
    const initial = nearestNeighbor(ctx);
    return { order: twoOptImprove(ctx, initial, Date.now() + TIME_BUDGET_MS) };
  }
}
