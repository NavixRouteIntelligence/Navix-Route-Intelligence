import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { transactionContext } from '../../../shared/database/transaction-context';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { EtaMetrics } from '../infrastructure/observability/eta-metrics';
import { RecordEtaObservationUseCase } from './record-eta-observation.use-case';

/**
 * Fecha o par previsão↔real toda vez que uma entrega é concluída (ADR-0087).
 *
 * Consome o `delivery.status-changed` que já existe desde a ADR-0023 — nenhum
 * publicador novo, nenhuma escrita no caminho da entrega.
 */
@Injectable()
export class EtaQualityListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EtaQualityListener');
  private subscription?: Subscription;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bus: DomainEventBus,
    private readonly record: RecordEtaObservationUseCase,
    private readonly metrics: EtaMetrics,
  ) {}

  onModuleInit(): void {
    this.subscription = this.bus
      .stream()
      .pipe(filter((m) => m.event.type === 'delivery.status-changed'))
      .subscribe((m) => void this.handle(m.tenantId, m.event.aggregateId));

    this.logger.log('Medição do erro de ETA ativa.');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async handle(tenantId: string, deliveryId: string): Promise<void> {
    try {
      const observation = await this.withTenant(tenantId, () =>
        this.record.execute(tenantId, deliveryId),
      );
      if (observation) this.metrics.record(observation.errorMinutes);
    } catch (err) {
      // Medir é observacional: a entrega já aconteceu, e perder uma amostra
      // nunca justifica propagar erro para quem a concluiu.
      this.logger.warn(
        `Não foi possível medir o ETA da entrega ${deliveryId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Abre a transação com `app.current_tenant` — o que o
   * `TenantTransactionInterceptor` faria numa requisição.
   *
   * Sem isto a RLS não bloqueia com erro: apenas **não devolve linhas**, a
   * entrega parece inexistente e a medição some em silêncio. É a quarta
   * ocorrência do mesmo padrão (ADR-0082/0083/0084/0086).
   */
  private withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, fn);
    });
  }
}
