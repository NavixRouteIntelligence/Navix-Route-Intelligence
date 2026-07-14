import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { filter } from 'rxjs/operators';
import type { Subscription } from 'rxjs';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { REOPTIMIZATION_TRIGGERS } from '../../../shared/events/domain-event';

/** Executa a reotimização de um tenant (estabelece contexto de tenant/tx). */
export interface ReoptimizationTriggerPort {
  run(tenantId: string): Promise<void>;
}

export const REOPTIMIZATION_TRIGGER = Symbol('REOPTIMIZATION_TRIGGER');

/**
 * Reotimização **automática** (ADR-0023): assina o `DomainEventBus` e, a cada
 * mudança relevante de entrega (criação/edição/status/exclusão), agenda uma
 * reotimização do tenant. **Debounce por tenant** coalesce rajadas (ex.: import
 * em massa) em um único job. Delega a execução ao `ReoptimizationTriggerPort`
 * (que estabelece a transação de tenant), mantendo esta classe testável.
 *
 * **Opt-in**: só age quando `OPTIMIZER_AUTO_REOPTIMIZE=true` (default off) — assim
 * não muda o comportamento atual nem gera jobs inesperados em dev/test.
 */
@Injectable()
export class AutoReoptimizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AutoReoptimization');
  private subscription?: Subscription;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly bus: DomainEventBus,
    private readonly config: AppConfigService,
    @Inject(REOPTIMIZATION_TRIGGER) private readonly trigger: ReoptimizationTriggerPort,
  ) {}

  onModuleInit(): void {
    const { autoReoptimize } = this.config.optimizer;
    if (!autoReoptimize) return;
    this.subscription = this.bus
      .stream()
      .pipe(filter((m) => REOPTIMIZATION_TRIGGERS.includes(m.event.type)))
      .subscribe((m) => this.schedule(m.tenantId));
    this.logger.log('Reotimização automática ativa (debounce por tenant).');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /** Agenda/reagenda a reotimização do tenant (coalesce rajadas). */
  private schedule(tenantId: string): void {
    const existing = this.timers.get(tenantId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.timers.delete(tenantId);
      void this.trigger.run(tenantId).catch((err) => {
        this.logger.error(
          `Reotimização automática do tenant ${tenantId} falhou: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }, this.config.optimizer.reoptimizeDebounceMs);
    if (typeof timer.unref === 'function') timer.unref(); // não segura o event loop
    this.timers.set(tenantId, timer);
  }
}
