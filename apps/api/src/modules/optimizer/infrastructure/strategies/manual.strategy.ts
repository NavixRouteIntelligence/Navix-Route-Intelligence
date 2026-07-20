import { Injectable } from '@nestjs/common';
import type { OptimizationStrategyName } from '@navix/contracts';

import type {
  RouteOptimizationStrategy,
  StrategyContext,
  StrategyResult,
} from '../../domain/ports/route-optimization-strategy.port';

/**
 * Estratégia de **ordem manual** (identidade): preserva exatamente a sequência
 * de paradas informada pelo cliente, sem reordenar. É a fundação do Routing
 * Strategy Engine (ADR-0062): o motorista arrasta as entregas na ordem que
 * quiser e o motor continua calculando distância, tempo, janelas e score para
 * ESSA ordem — a otimização deixa de ser tudo-ou-nada.
 *
 * A origem (depósito), quando existe, já é o nó 0 e permanece em primeiro.
 * Uma ordenação "livre + travas" (reotimizar só as paradas não fixadas) é a
 * próxima fatia; entra pela mesma port, sem alterar esta estratégia.
 */
@Injectable()
export class ManualStrategy implements RouteOptimizationStrategy {
  readonly name: OptimizationStrategyName = 'manual';

  optimize(ctx: StrategyContext): StrategyResult {
    return { order: Array.from({ length: ctx.size }, (_, i) => i) };
  }
}
