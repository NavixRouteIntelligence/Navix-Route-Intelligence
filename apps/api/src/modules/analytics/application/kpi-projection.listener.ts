import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { transactionContext } from '../../../shared/database/transaction-context';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import type { DomainEventType } from '../../../shared/events/domain-event';
import { RebuildKpisUseCase } from './rebuild-kpis.use-case';

/**
 * Eventos que mudam algum número do dia.
 *
 * `tracking.position-recorded` fica **de fora**: posição chega a cada poucos
 * segundos e não altera KPI nenhum — reprojetar por ela seria puro desperdício.
 */
const GATILHOS: readonly DomainEventType[] = [
  'delivery.status-changed',
  'delivery.deleted',
  'route.plan-created',
];

/**
 * Mantém o read model diário em dia (ADR-0092).
 *
 * Reprojeta **o dia corrente** do tenant afetado. Não é incremental: recalcular
 * é idempotente, e um evento reprocessado não pode inflar o número — que é o
 * risco real de um `+1` num sistema com retry.
 *
 * O `debounce` por tenant evita reprojetar dezenas de vezes durante uma
 * importação em lote, onde cada entrega dispara um evento.
 */
@Injectable()
export class KpiProjectionListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KpiProjection');
  private subscription?: Subscription;
  private readonly pendentes = new Map<string, NodeJS.Timeout>();

  /** Janela de agrupamento: curta o bastante para o dashboard parecer imediato. */
  private static readonly DEBOUNCE_MS = 3_000;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bus: DomainEventBus,
    private readonly rebuild: RebuildKpisUseCase,
  ) {}

  onModuleInit(): void {
    this.subscription = this.bus
      .stream()
      .pipe(filter((m) => GATILHOS.includes(m.event.type)))
      .subscribe((m) => this.schedule(m.tenantId));

    this.logger.log('Projeção de KPIs ativa.');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    for (const timer of this.pendentes.values()) clearTimeout(timer);
    this.pendentes.clear();
  }

  private schedule(tenantId: string): void {
    const pendente = this.pendentes.get(tenantId);
    if (pendente) clearTimeout(pendente);

    this.pendentes.set(
      tenantId,
      setTimeout(() => {
        this.pendentes.delete(tenantId);
        void this.project(tenantId);
      }, KpiProjectionListener.DEBOUNCE_MS),
    );
  }

  private async project(tenantId: string): Promise<void> {
    try {
      await this.withTenant(tenantId, () => this.rebuild.day(tenantId));
    } catch (err) {
      // Projetar é manutenção de índice: falhar aqui atrasa um número no
      // dashboard, e isso nunca justifica afetar quem gerou o evento.
      this.logger.warn(
        `Falha ao projetar KPIs do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Abre a transação com `app.current_tenant`. Fora de requisição a RLS não dá
   * erro — devolve zero linhas —, e aqui o efeito seria pior que silencioso: o
   * read model gravaria **zeros** por cima de números corretos.
   */
  private withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, fn);
    });
  }
}
