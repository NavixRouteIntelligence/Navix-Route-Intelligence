import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { filter } from 'rxjs/operators';
import type { Subscription } from 'rxjs';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { REOPTIMIZATION_TRIGGERS } from '../../../shared/events/domain-event';
import { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';

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
  /**
   * Instante do **primeiro** evento da janela de debounce, por tenant. É a
   * origem do SLA: a latência que interessa começa quando o fato aconteceu, não
   * quando o debounce expirou (ADR-0083).
   */
  private readonly firstEventAt = new Map<string, number>();

  constructor(
    private readonly bus: DomainEventBus,
    private readonly config: AppConfigService,
    @Inject(REOPTIMIZATION_TRIGGER) private readonly trigger: ReoptimizationTriggerPort,
    private readonly features: FeatureAccessService,
    private readonly metrics: OptimizerMetrics,
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
    // Só o primeiro evento da rajada marca o início: reagendar não pode
    // "zerar" o relógio, senão o SLA mediria menos do que o cliente espera.
    if (!this.firstEventAt.has(tenantId)) this.firstEventAt.set(tenantId, Date.now());

    const timer = setTimeout(() => {
      this.timers.delete(tenantId);
      const startedAt = this.firstEventAt.get(tenantId) ?? Date.now();
      this.firstEventAt.delete(tenantId);

      void this.runIfAllowed(tenantId, startedAt).catch((err) => {
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

  /**
   * Aplica o gate de plano e mede o SLA.
   *
   * A reotimização dinâmica é **premium** (`docs/strategy/pricing-navix.md`):
   * um tenant `free` recebe os eventos normalmente, mas nada é enfileirado —
   * ele continua com a rota que a IA preparou na importação.
   */
  private async runIfAllowed(tenantId: string, startedAt: number): Promise<void> {
    if (!(await this.features.isEnabled(tenantId, 'dynamic_reoptimization'))) {
      this.metrics.reoptimizationSkipped('plan');
      return;
    }

    await this.trigger.run(tenantId);
    // Evento → job enfileirado (inclui o debounce). O tempo de fila e o solve
    // são medidos separadamente; ver o SLA no ADR-0083.
    this.metrics.observeReoptimizationTrigger((Date.now() - startedAt) / 1000);
  }
}
