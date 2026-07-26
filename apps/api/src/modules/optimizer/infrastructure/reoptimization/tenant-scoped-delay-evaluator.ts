import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { RouteDelayEvaluatorPort } from '../../application/delay-detection.service';
import { DELIVERY_GATEWAY, type DeliveryGatewayPort } from '../../application/ports/delivery-gateway.port';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../../domain/ports/route-plan-repository.port';

/**
 * Mede o atraso da rota corrente (ADR-0083), estabelecendo a transação de
 * tenant própria — mesmo padrão do `TenantScopedReoptimizationTrigger`, porque
 * também roda fora de uma requisição.
 *
 * ## Como o atraso é medido
 *
 * O plano guarda `etaMinutes` por parada, **relativo ao início da rota**. Como
 * não há registro de "a rota começou às X", o instante de criação do plano é
 * usado como origem — a mesma heurística do rastreamento público (ADR-0082).
 *
 *     atraso = agora − (plano.criadoEm + etaMinutes da parada)
 *
 * Considera a **primeira parada ainda ativa** (pendente/em rota): é a que o
 * motorista deveria estar atendendo. Paradas já entregues saem da conta.
 *
 * **Limite conhecido:** a heurística assume que a rota começou quando foi
 * calculada. Um plano preparado de manhã e executado à tarde acusa atraso que
 * não existe. Ancorar no início real da jornada é o próximo passo (é a mesma
 * lacuna do ETA do ADR-0082, que a Fase 3 resolve com modelo real).
 */
@Injectable()
export class TenantScopedDelayEvaluator implements RouteDelayEvaluatorPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
    @Inject(DELIVERY_GATEWAY) private readonly delivery: DeliveryGatewayPort,
  ) {}

  async evaluate(tenantId: string): Promise<number | null> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, async () => {
        const page = await this.plans.findAll(tenantId, { page: 1, pageSize: 1 });
        const plan = page.items[0];
        if (!plan) return null;

        const active = await this.delivery.listActiveStops(tenantId);
        if (active.length === 0) return null;
        const activeIds = new Set(active.map((s) => s.id));

        const snapshot = plan.snapshot();
        // As paradas já vêm em ordem de sequência no plano.
        const next = snapshot.stops.find((s) => activeIds.has(s.deliveryId));
        if (!next) return null;

        const expectedAt = snapshot.createdAt.getTime() + next.etaMinutes * 60_000;
        const delayMs = Date.now() - expectedAt;
        return delayMs <= 0 ? 0 : delayMs / 60_000;
      });
    });
  }
}
