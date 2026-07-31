import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import type { DelayRiskAlert } from '@navix/contracts';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { transactionContext } from '../../../shared/database/transaction-context';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { RealtimeHub } from '../../../shared/realtime/realtime-hub';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import { RISK_HIGH } from '../../intelligence/domain/breach-risk';
import { NotifyRecipientUseCase } from '../../notifications/application/notify-recipient.use-case';
import {
  OPTIMIZER_SERVICE,
  type OptimizerServicePort,
} from '../../optimizer/application/optimizer.service';
import {
  TENANT_PLAN,
  type TenantPlanPort,
} from '../../optimizer/application/ports/tenant-plan.port';
import { DelayRiskRegistry } from './delay-risk.registry';
import { PredictBreachRiskUseCase, type StopToAssess } from './predict-breach-risk.use-case';

/**
 * Alertas preditivos de estouro de janela (ADR-0091).
 *
 * ## Por que este gatilho, e não um novo
 *
 * Usa o `tracking.position-recorded` que já existe (ADR-0083): é o único sinal
 * de que algo mudou no mundo real. Nenhum publicador novo, nenhuma escrita no
 * caminho do motorista.
 *
 * O throttle por tenant é o mesmo desenho do detector de atraso — posição chega
 * a cada poucos segundos, e reavaliar a rota inteira a cada uma seria insano.
 *
 * ## Dois destinatários, duas regras
 *
 * À **empresa** vai todo risco relevante, por SSE: quem despacha pode agir
 * (reordenar, realocar), e um alerta a mais custa atenção. Ao **destinatário**
 * só o risco alto, pela via de notificação que já existe (ADR-0084) — com a
 * dedup, o opt-out e o i18n dela. Avisar o cliente de uma suspeita que não se
 * confirma corrói a confiança no aviso seguinte.
 */
@Injectable()
export class DelayRiskAlertListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DelayRiskAlert');
  private subscription?: Subscription;
  private readonly lastCheck = new Map<string, number>();
  private readonly inFlight = new Set<string>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly bus: DomainEventBus,
    private readonly config: AppConfigService,
    private readonly predict: PredictBreachRiskUseCase,
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(OPTIMIZER_SERVICE) private readonly optimizer: OptimizerServicePort,
    @Inject(TENANT_PLAN) private readonly plan: TenantPlanPort,
    private readonly realtime: RealtimeHub,
    private readonly notify: NotifyRecipientUseCase,
    private readonly registry: DelayRiskRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.delayRiskAlerts.enabled) {
      this.logger.log('Alertas preditivos de atraso desativados por configuração.');
      return;
    }

    this.subscription = this.bus
      .stream()
      .pipe(filter((m) => m.event.type === 'tracking.position-recorded'))
      .subscribe((m) => void this.check(m.tenantId));

    this.logger.log('Alertas preditivos de atraso ativos (premium, throttle por tenant).');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    this.lastCheck.clear();
    this.inFlight.clear();
  }

  private async check(tenantId: string): Promise<void> {
    const { checkIntervalMs } = this.config.delayRiskAlerts;

    const last = this.lastCheck.get(tenantId) ?? 0;
    if (Date.now() - last < checkIntervalMs) return;
    if (this.inFlight.has(tenantId)) return;

    this.lastCheck.set(tenantId, Date.now());
    this.inFlight.add(tenantId);
    try {
      // Gate antes de qualquer consulta: recurso pago não gasta banco de quem
      // não paga. Negar é o padrão em caso de falha (ver `TenantPlanPort`).
      if (!(await this.plan.allowsPredictiveAlerts(tenantId))) return;

      await this.withTenant(tenantId, () => this.assess(tenantId));
    } catch (err) {
      // Best-effort, como o detector de atraso: alertar não pode derrubar a
      // ingestão de posições, que é o caminho crítico do motorista.
      this.logger.warn(
        `Falha ao avaliar risco do tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.inFlight.delete(tenantId);
    }
  }

  private async assess(tenantId: string): Promise<void> {
    const ativas = await this.deliveries.listNotifiableActive(tenantId);
    if (ativas.length === 0) return;

    // As janelas vêm do Delivery; a chegada prevista, do plano vigente — já
    // corrigida pelo modelo (ADR-0090), que é o que torna esta conta melhor
    // do que a da heurística pura.
    const paradas = await this.deliveries.getStops(
      tenantId,
      ativas.map((d) => d.id),
    );
    const janelaPorEntrega = new Map(paradas.map((p) => [p.id, p.timeWindow]));

    const aAvaliar: StopToAssess[] = [];
    for (const entrega of ativas) {
      const janela = janelaPorEntrega.get(entrega.id);
      // Sem janela não há o que estourar.
      if (!janela) continue;
      const previsao = await this.optimizer.etaPredictionForDelivery(tenantId, entrega.id);
      if (!previsao) continue;
      aAvaliar.push({
        deliveryId: entrega.id,
        predictedArrival: previsao.arrivalAt,
        // A janela vem do contrato em ISO; a conta é em Date.
        windowEnd: new Date(janela.end),
      });
    }

    const avaliadas = await this.predict.execute(tenantId, aAvaliar);
    const porEntrega = new Map(ativas.map((d) => [d.id, d]));
    const alertas: DelayRiskAlert[] = [];

    for (const parada of avaliadas) {
      if (parada.risk.level === 'low') continue;

      const entrega = porEntrega.get(parada.deliveryId);
      const alerta: DelayRiskAlert = {
        deliveryId: parada.deliveryId,
        driverId: entrega?.driverId ?? null,
        severity: parada.risk.level,
        probability: parada.risk.probability,
        slackMinutes: parada.risk.slackMinutes,
        predictedArrival: parada.predictedArrival.toISOString(),
        windowEnd: parada.windowEnd.toISOString(),
        samples: parada.risk.samples,
      };
      alertas.push(alerta);

      this.realtime.publish(tenantId, { type: 'alert.delay-risk', data: alerta });

      // Só o risco alto chega ao destinatário. A dedup por entrega/evento do
      // `notification_log` (ADR-0084) garante um aviso só, mesmo com a rota
      // seguindo em risco a cada avaliação.
      if (parada.risk.probability >= RISK_HIGH) {
        await this.notify.execute(tenantId, parada.deliveryId, 'delayed');
      }
    }

    // Retrato completo, inclusive vazio: quem lê por polling (o app) precisa
    // ver o risco **sumir** quando ele deixa de existir, não só aparecer.
    this.registry.replace(tenantId, alertas);
  }

  /**
   * Abre a transação com `app.current_tenant` — fora de requisição a RLS não dá
   * erro, apenas devolve zero linhas, e o alerta sumiria em silêncio (quinta
   * ocorrência do padrão; ver ADR-0082/0083/0084/0086/0087).
   */
  private withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, fn);
    });
  }
}
