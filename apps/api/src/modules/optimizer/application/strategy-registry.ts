import { Inject, Injectable } from '@nestjs/common';
import type { OptimizationStrategyName } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import {
  OPTIMIZATION_STRATEGIES,
  type RouteOptimizationStrategy,
} from '../domain/ports/route-optimization-strategy.port';

const DEFAULT_STRATEGY: OptimizationStrategyName = 'nearest-neighbor-2opt';

/**
 * Seleciona a estratégia de otimização por nome (Strategy Pattern). Novas
 * estratégias entram apenas registrando-se no módulo — nada muda aqui.
 */
@Injectable()
export class StrategyRegistry {
  private readonly byName = new Map<string, RouteOptimizationStrategy>();

  constructor(
    @Inject(OPTIMIZATION_STRATEGIES) strategies: RouteOptimizationStrategy[],
  ) {
    for (const strategy of strategies) {
      this.byName.set(strategy.name, strategy);
    }
  }

  get(name?: OptimizationStrategyName): RouteOptimizationStrategy {
    const strategy = this.byName.get(name ?? DEFAULT_STRATEGY);
    if (!strategy) {
      throw new ValidationError(`Estratégia de otimização desconhecida: ${name}.`);
    }
    return strategy;
  }
}
