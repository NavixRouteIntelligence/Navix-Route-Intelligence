import { Inject, Injectable } from '@nestjs/common';
import type { OptimizationJobAccepted } from '@navix/contracts';

import { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';
import { DELIVERY_GATEWAY, type DeliveryGatewayPort } from './ports/delivery-gateway.port';

export interface ReoptimizeActiveCommand {
  tenantId: string;
  actorId: string;
}

/**
 * Reotimiza as entregas **ativas** (pendente/em rota) do tenant, enfileirando um
 * job (ADR-0023). Reusa o `EnqueueOptimizationUseCase` (mesma fila/SSE). É o
 * ponto único chamado tanto pelo gatilho **automático** (eventos de domínio)
 * quanto pelo endpoint **manual** (trânsito/eventos externos).
 *
 * Devolve `null` (no-op) quando há menos de 2 paradas ativas — nada a otimizar.
 */
@Injectable()
export class ReoptimizeActiveUseCase {
  constructor(
    @Inject(DELIVERY_GATEWAY) private readonly delivery: DeliveryGatewayPort,
    private readonly enqueue: EnqueueOptimizationUseCase,
    private readonly features: FeatureAccessService,
  ) {}

  async execute(command: ReoptimizeActiveCommand): Promise<OptimizationJobAccepted | null> {
    // Gate no caso de uso: protege tanto o endpoint manual quanto qualquer novo
    // chamador interno. A automação também verifica antes de abrir a transação,
    // evitando trabalho desnecessário para planos sem direito.
    await this.features.require(command.tenantId, 'dynamic_reoptimization');

    const active = await this.delivery.listActiveStops(command.tenantId);
    if (active.length < 2) return null;
    return this.enqueue.execute({
      tenantId: command.tenantId,
      actorId: command.actorId,
      deliveryIds: active.map((s) => s.id),
    });
  }
}
