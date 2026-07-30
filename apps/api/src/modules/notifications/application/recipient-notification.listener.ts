import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Subscription } from 'rxjs';
import { DataSource } from 'typeorm';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { transactionContext } from '../../../shared/database/transaction-context';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { haversineKm } from '../../../shared/kernel/geo';
import type { NotificationEvent } from '../domain/notification-event';
import { NotifyRecipientUseCase } from './notify-recipient.use-case';
import {
  DELIVERY_CONTACT_GATEWAY,
  type DeliveryContactGatewayPort,
} from './ports/notification-sources.port';

/**
 * Traduz eventos de domínio em notificações ao destinatário (ADR-0084).
 *
 * **Não cria pipeline novo:** assina o mesmo `DomainEventBus` que a reotimização
 * dinâmica (ADR-0023/0083) e reaproveita os eventos que já existem —
 * `delivery.status-changed` para "saiu"/"entregue", `route.delay-detected` para
 * "atrasado" e `tracking.position-recorded` para "está chegando".
 *
 * O aviso de proximidade é o único que precisa de cálculo próprio, e ele é
 * deliberadamente barato: distância em linha reta entre a posição e o destino,
 * com throttle por motorista. Não consulta rota nem provedor de mapas — para
 * decidir "mandar ou não um aviso", precisão de rota seria custo sem ganho.
 */
@Injectable()
export class RecipientNotificationListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RecipientNotification');
  private subscription?: Subscription;
  /** Último instante avaliado por motorista (throttle do aviso de proximidade). */
  private readonly lastProximityCheck = new Map<string, number>();

  constructor(
    private readonly bus: DomainEventBus,
    private readonly config: AppConfigService,
    private readonly notify: NotifyRecipientUseCase,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(DELIVERY_CONTACT_GATEWAY) private readonly deliveries: DeliveryContactGatewayPort,
  ) {}

  onModuleInit(): void {
    if (!this.config.notifications.enabled) return;

    this.subscription = this.bus.stream().subscribe((m) => {
      void this.withTenant(m.tenantId, () =>
        this.handle(m.tenantId, m.event.type, m.event.aggregateId),
      ).catch((err) => {
        // Notificar é acessório: nunca pode derrubar quem publicou o evento.
        this.logger.warn(
          `Falha ao tratar ${m.event.type}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });
    this.logger.log('Notificações ao destinatário ativas.');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    this.lastProximityCheck.clear();
  }

  /**
   * Abre a transação com `app.current_tenant` — o que o
   * `TenantTransactionInterceptor` faria numa requisição.
   *
   * Sem isto a RLS não bloqueia com erro: ela simplesmente **não devolve
   * linhas**, e a entrega parece inexistente. O aviso some em silêncio, que é o
   * pior desfecho possível. Mesmo padrão do `TenantScopedReoptimizationTrigger`.
   */
  private withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, fn);
    });
  }

  private async handle(tenantId: string, type: string, aggregateId: string): Promise<void> {
    switch (type) {
      case 'delivery.status-changed':
        // O evento não carrega o status novo, então perguntamos à entrega.
        await this.onStatusChanged(tenantId, aggregateId);
        return;
      case 'route.delay-detected':
        await this.onDelay(tenantId, aggregateId);
        return;
      case 'tracking.position-recorded':
        await this.onPosition(tenantId, aggregateId);
        return;
      default:
        return;
    }
  }

  /** `in_route` → "saiu para entrega"; `delivered` → "entregue". */
  private async onStatusChanged(tenantId: string, deliveryId: string): Promise<void> {
    const delivery = await this.deliveries.find(tenantId, deliveryId);
    if (!delivery) return;
    const event: NotificationEvent | null =
      delivery.status === 'in_route'
        ? 'dispatched'
        : delivery.status === 'delivered'
          ? 'delivered'
          : null;
    if (!event) return;
    await this.notify.execute(tenantId, deliveryId, event);
  }

  /**
   * O atraso é detectado por **rota** (ADR-0083), não por entrega: avisamos as
   * entregas ainda ativas do tenant. O `claim` garante um aviso por entrega,
   * então uma rota que segue atrasada não vira enxurrada de e-mails.
   */
  private async onDelay(tenantId: string, _aggregateId: string): Promise<void> {
    const pending = await this.deliveries.activePendingNotification(tenantId);
    for (const delivery of pending) {
      await this.notify.execute(tenantId, delivery.id, 'delayed');
    }
  }

  /** Posição recebida: alguma entrega deste motorista está perto o bastante? */
  private async onPosition(tenantId: string, driverId: string): Promise<void> {
    const { proximityCheckIntervalMs, proximityRadiusKm } = this.config.notifications;

    const key = `${tenantId}:${driverId}`;
    const last = this.lastProximityCheck.get(key) ?? 0;
    if (Date.now() - last < proximityCheckIntervalMs) return;
    this.lastProximityCheck.set(key, Date.now());

    const position = await this.deliveries.lastPositionOf(tenantId, driverId);
    if (!position) return;

    const active = await this.deliveries.activeForDriver(tenantId, driverId);
    for (const delivery of active) {
      const km = haversineKm(
        { latitude: position.latitude, longitude: position.longitude },
        { latitude: delivery.latitude, longitude: delivery.longitude },
      );
      if (km <= proximityRadiusKm) {
        await this.notify.execute(tenantId, delivery.id, 'nearby');
      }
    }
  }
}
