import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DataSource } from 'typeorm';

import { transactionContext } from '../../../shared/database/transaction-context';
import type { DomainEventType } from '../../../shared/events/domain-event';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';

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
  'finance.entry-created',
  'finance.entry-deleted',
  'route.plan-created',
];

/**
 * Mantém o read model diário em dia (ADR-0092).
 *
 * Reprojeta **o dia informado pelo evento** do tenant afetado. Não é incremental:
 * recalcular é idempotente, e um evento reprocessado não pode inflar o número —
 * que é o risco real de um `+1` num sistema com retry.
 *
 * O `debounce` por tenant e dia evita reprojetar dezenas de vezes durante uma
 * importação em lote, onde cada entrega dispara um evento.
 */
@Injectable()
export class KpiProjectionListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KpiProjection');
  private subscription?: Subscription;
  private readonly pendentes = new Map<string, NodeJS.Timeout>();
  private initialReconciliation?: NodeJS.Timeout;
  private reconciliationTimer?: NodeJS.Timeout;

  /** Janela de agrupamento: curta o bastante para o dashboard parecer imediato. */
  private static readonly DEBOUNCE_MS = 3_000;
  private static readonly MAX_RETRIES = 3;
  private static readonly RECONCILE_DAYS = 30;
  private static readonly RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1_000;
  private static readonly RECONCILE_LOCK = [740_092, 1] as const;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bus: DomainEventBus,
    private readonly rebuild: RebuildKpisUseCase,
  ) {}

  onModuleInit(): void {
    this.subscription = this.bus
      .stream()
      .pipe(filter((m) => GATILHOS.includes(m.event.type)))
      .subscribe((m) =>
        this.schedule(m.tenantId, m.event.affectedDay ?? new Date().toISOString().slice(0, 10)),
      );

    // Rede de segurança durável: eventos são in-process, então uma reinicialização
    // durante o debounce poderia perdê-los. A reconciliação recompõe a janela que
    // o dashboard lê. Advisory lock impede trabalho duplicado entre réplicas.
    this.initialReconciliation = setTimeout(() => {
      void this.reconcileRecent();
    }, 10_000);
    this.reconciliationTimer = setInterval(() => {
      void this.reconcileRecent();
    }, KpiProjectionListener.RECONCILE_INTERVAL_MS);

    this.logger.log('Projeção de KPIs ativa.');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    for (const timer of this.pendentes.values()) clearTimeout(timer);
    this.pendentes.clear();
    if (this.initialReconciliation) clearTimeout(this.initialReconciliation);
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
  }

  private schedule(tenantId: string, day: string, attempt = 0): void {
    const key = `${tenantId}:${day}`;
    const pendente = this.pendentes.get(key);
    if (pendente) clearTimeout(pendente);

    this.pendentes.set(
      key,
      setTimeout(
        () => {
          this.pendentes.delete(key);
          void this.project(tenantId, day, attempt);
        },
        attempt === 0
          ? KpiProjectionListener.DEBOUNCE_MS
          : KpiProjectionListener.DEBOUNCE_MS * 2 ** attempt,
      ),
    );
  }

  private async project(tenantId: string, day: string, attempt: number): Promise<void> {
    try {
      await this.withTenant(tenantId, () => this.rebuild.day(tenantId, day));
    } catch (err) {
      // Projetar é manutenção de índice: falhar aqui atrasa um número no
      // dashboard, e isso nunca justifica afetar quem gerou o evento.
      this.logger.warn(
        `Falha ao projetar KPIs do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (attempt < KpiProjectionListener.MAX_RETRIES) {
        this.schedule(tenantId, day, attempt + 1);
      }
    }
  }

  /**
   * Recalcula periodicamente a janela visível do dashboard. É o mecanismo de
   * recuperação para reinício entre evento e projeção ou falhas esgotadas após
   * os retries. A projeção continua orientada a eventos; isto é apenas reparo.
   */
  private async reconcileRecent(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const lockRows = (await runner.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [
        ...KpiProjectionListener.RECONCILE_LOCK,
      ])) as { locked: boolean }[];
      locked = lockRows[0]?.locked === true;
      if (!locked) return;

      const tenants = (await runner.query('SELECT id::text AS id FROM tenants ORDER BY id')) as {
        id: string;
      }[];
      for (const tenant of tenants) {
        await runner.startTransaction();
        try {
          await runner.manager.query("SELECT set_config('app.current_tenant', $1, true)", [
            tenant.id,
          ]);
          await transactionContext.run(runner.manager, () =>
            this.rebuild.backfill(tenant.id, KpiProjectionListener.RECONCILE_DAYS),
          );
          await runner.commitTransaction();
        } catch (err) {
          await runner.rollbackTransaction();
          this.logger.warn(
            `Falha ao reconciliar KPIs do tenant ${tenant.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Falha na reconciliação periódica de KPIs: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      try {
        if (locked) {
          await runner.query('SELECT pg_advisory_unlock($1, $2)', [
            ...KpiProjectionListener.RECONCILE_LOCK,
          ]);
        }
      } finally {
        await runner.release();
      }
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
