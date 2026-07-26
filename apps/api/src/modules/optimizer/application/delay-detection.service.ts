import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { filter } from 'rxjs/operators';
import type { Subscription } from 'rxjs';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';

/**
 * Avalia, sob a transação de tenant, se a rota corrente está atrasada.
 * Devolve o atraso em minutos da parada mais adiantada em atraso, ou `null`
 * quando não há plano/parada pendente.
 */
export interface RouteDelayEvaluatorPort {
  evaluate(tenantId: string): Promise<number | null>;
}

export const ROUTE_DELAY_EVALUATOR = Symbol('ROUTE_DELAY_EVALUATOR');

/**
 * Detector de **atraso** (ADR-0083) — o gatilho que faltava para a reotimização
 * dinâmica: até aqui só mudanças de entrega (criação/edição/status/exclusão)
 * reotimizavam, e "a rota atrasou" não era observável em lugar nenhum.
 *
 * Escuta `tracking.position-recorded` como *tick* (o motorista está rodando) e,
 * quando o atraso passa do limiar, publica `route.delay-detected` — que o
 * `AutoReoptimizationService` já trata com debounce por tenant. Ou seja: **o
 * pipeline de reotimização não muda**, só ganha uma nova origem de evento.
 *
 * ## Por que não avaliar em toda posição
 *
 * Posições chegam a cada poucos segundos por motorista. Avaliar cada uma
 * significaria ler o plano e as entregas ativas dezenas de vezes por minuto e
 * por tenant. O `throttle` deixa passar no máximo uma avaliação por tenant a
 * cada `OPTIMIZER_DELAY_CHECK_INTERVAL_MS`.
 */
@Injectable()
export class DelayDetectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DelayDetection');
  private subscription?: Subscription;
  /** Último instante avaliado por tenant (janela do throttle). */
  private readonly lastCheck = new Map<string, number>();
  /** Evita avaliações concorrentes do mesmo tenant. */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly bus: DomainEventBus,
    private readonly config: AppConfigService,
    @Inject(ROUTE_DELAY_EVALUATOR) private readonly evaluator: RouteDelayEvaluatorPort,
  ) {}

  onModuleInit(): void {
    // Mesma flag mestre da reotimização automática: sem ela, detectar atraso não
    // teria consequência alguma (ninguém reotimizaria).
    if (!this.config.optimizer.autoReoptimize) return;

    this.subscription = this.bus
      .stream()
      .pipe(filter((m) => m.event.type === 'tracking.position-recorded'))
      .subscribe((m) => void this.check(m.tenantId));

    this.logger.log('Detecção de atraso ativa (throttle por tenant).');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    this.lastCheck.clear();
    this.inFlight.clear();
  }

  private async check(tenantId: string): Promise<void> {
    const { delayCheckIntervalMs, delayThresholdMinutes } = this.config.optimizer;

    const last = this.lastCheck.get(tenantId) ?? 0;
    if (Date.now() - last < delayCheckIntervalMs) return;
    if (this.inFlight.has(tenantId)) return;

    this.lastCheck.set(tenantId, Date.now());
    this.inFlight.add(tenantId);
    try {
      const delayMinutes = await this.evaluator.evaluate(tenantId);
      if (delayMinutes === null || delayMinutes < delayThresholdMinutes) return;

      this.logger.log(
        `Tenant ${tenantId}: rota atrasada em ${delayMinutes.toFixed(1)} min — reotimizando.`,
      );
      this.bus.publish(tenantId, {
        type: 'route.delay-detected',
        // Não há um agregado único: o atraso é da rota corrente do tenant.
        aggregateId: tenantId,
      });
    } catch (err) {
      // Detectar atraso é best-effort: falhar aqui não pode derrubar a ingestão
      // de posições, que é o caminho crítico do motorista.
      this.logger.warn(
        `Falha ao avaliar atraso do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.inFlight.delete(tenantId);
    }
  }
}
