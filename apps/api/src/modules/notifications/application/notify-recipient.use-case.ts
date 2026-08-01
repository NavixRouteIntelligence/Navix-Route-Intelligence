import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import type { NotificationChannel, NotificationEvent } from '../domain/notification-event';
import {
  NOTIFICATION_REGISTRY,
  type NotificationRegistryPort,
} from '../domain/ports/notification-registry.port';
import {
  NOTIFICATION_SENDER,
  type NotificationSenderPort,
} from '../domain/ports/notification-sender.port';
import { renderNotification, resolveLocale } from '../domain/notification-templates';
import {
  DELIVERY_CONTACT_GATEWAY,
  TRACKING_LINK_GATEWAY,
  type DeliveryContactGatewayPort,
  type TrackingLinkGatewayPort,
} from './ports/notification-sources.port';

/** Motivos de não envio — úteis em teste e log, nunca expostos ao público. */
export type SkipReason =
  | 'sem-contato'
  | 'opt-out'
  | 'ja-enviado'
  | 'entrega-inexistente'
  | 'canal-indisponivel'
  | 'plano'
  | 'desligado';

export type NotifyOutcome = { sent: true } | { sent: false; reason: SkipReason };

/**
 * Envia **uma** notificação de acompanhamento ao destinatário (ADR-0084).
 *
 * A ordem das verificações não é acidental: primeiro o que evita trabalho
 * (feature desligada, entrega inexistente, sem contato), depois o que protege o
 * destinatário (opt-out), e só então o `claim` — que é a barreira de duplicidade
 * e, por ser uma escrita única no banco, também resolve corrida entre processos.
 *
 * Falha de envio **não** propaga: notificar é acessório ao fluxo de entrega e
 * não pode derrubar quem publicou o evento.
 */
@Injectable()
export class NotifyRecipientUseCase {
  private readonly logger = new Logger('NotifyRecipient');

  constructor(
    private readonly config: AppConfigService,
    @Inject(DELIVERY_CONTACT_GATEWAY) private readonly deliveries: DeliveryContactGatewayPort,
    @Inject(TRACKING_LINK_GATEWAY) private readonly links: TrackingLinkGatewayPort,
    @Inject(NOTIFICATION_REGISTRY) private readonly registry: NotificationRegistryPort,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSenderPort,
    private readonly features: FeatureAccessService,
  ) {}

  async execute(
    tenantId: string,
    deliveryId: string,
    event: NotificationEvent,
  ): Promise<NotifyOutcome> {
    const { enabled, channel } = this.config.notifications;
    if (!enabled) return { sent: false, reason: 'desligado' };
    if (!(await this.features.isEnabled(tenantId, 'advanced_cx'))) {
      return { sent: false, reason: 'plano' };
    }
    if (!this.sender.supports(channel)) return { sent: false, reason: 'canal-indisponivel' };

    const delivery = await this.deliveries.find(tenantId, deliveryId);
    if (!delivery) return { sent: false, reason: 'entrega-inexistente' };

    const destination = this.destinationFor(delivery, channel);
    if (!destination) return { sent: false, reason: 'sem-contato' };

    if (await this.registry.isOptedOut(tenantId, channel, destination)) {
      return { sent: false, reason: 'opt-out' };
    }

    // Reserva ANTES de enviar: se duas réplicas reagirem ao mesmo evento, só
    // uma passa daqui. O custo é uma notificação perdida caso o envio falhe
    // depois — preferível a mandar duas ao destinatário.
    const claimed = await this.registry.claim({
      tenantId,
      deliveryId,
      event,
      channel,
      destination,
    });
    if (!claimed) return { sent: false, reason: 'ja-enviado' };

    const link = await this.links.urlFor(tenantId, deliveryId);
    const rendered = renderNotification(event, resolveLocale(this.config.notifications.locale), {
      recipient: delivery.recipient,
      trackingUrl: link.url,
      // O opt-out viaja pelo mesmo token do rastreio: o destinatário já o tem, e
      // isso evita um segundo mecanismo de credencial pública (ADR-0082).
      optOutUrl: `${link.url}?optout=1`,
    });

    try {
      await this.sender.send({ channel, destination, ...rendered });
      return { sent: true };
    } catch (err) {
      // O `claim` já foi gravado: esta notificação não será tentada de novo.
      // É a escolha certa para um aviso de acompanhamento — insistir arriscaria
      // duplicar, e um "saiu para entrega" atrasado não tem valor.
      this.logger.warn(
        `Falha ao notificar (${event}) a entrega ${deliveryId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { sent: false, reason: 'canal-indisponivel' };
    }
  }

  private destinationFor(
    delivery: { recipientEmail: string | null; recipientPhone: string | null },
    channel: NotificationChannel,
  ): string | null {
    return channel === 'email' ? delivery.recipientEmail : delivery.recipientPhone;
  }
}
