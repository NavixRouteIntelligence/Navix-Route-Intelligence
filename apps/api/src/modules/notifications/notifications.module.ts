import { Module } from '@nestjs/common';

import { DeliveryModule } from '../delivery/delivery.module';
import { PublicTrackingModule } from '../public-tracking/public-tracking.module';
import { TrackingModule } from '../tracking/tracking.module';
import { NotifyRecipientUseCase } from './application/notify-recipient.use-case';
import { OptOutByTrackingTokenUseCase } from './application/opt-out-by-tracking-token.use-case';
import { RecipientNotificationListener } from './application/recipient-notification.listener';
import {
  DELIVERY_CONTACT_GATEWAY,
  TRACKING_LINK_GATEWAY,
} from './application/ports/notification-sources.port';
import { NOTIFICATION_REGISTRY } from './domain/ports/notification-registry.port';
import { NOTIFICATION_SENDER } from './domain/ports/notification-sender.port';
import {
  DeliveryContactGateway,
  TrackingLinkGateway,
} from './infrastructure/gateways/notification-sources.gateways';
import { NotificationRepository } from './infrastructure/persistence/notification.repository';
import { LoggingNotificationSender } from './infrastructure/sender/logging-notification.sender';
import { PublicOptOutController } from './interface/public-opt-out.controller';

/**
 * Notificações ao destinatário (ADR-0084) — o lado B2B2C do rastreamento
 * público: cada aviso leva o link de rastreio, e é assim que quem recebe uma
 * entrega conhece a Navix.
 *
 * ## Direção das dependências
 *
 * `notifications → {delivery, public-tracking, tracking}`, sempre pelas APIs
 * públicas desses módulos. Nada aponta de volta para cá, então não existe o
 * ciclo que impediu o boot na ADR-0082 — a lição está aplicada.
 *
 * ## Sem pipeline novo
 *
 * O gatilho é o `DomainEventBus` que já existe (ADR-0023/0083). Este módulo só
 * traduz eventos de domínio em avisos; o tracking não foi tocado.
 */
@Module({
  imports: [DeliveryModule, PublicTrackingModule, TrackingModule],
  controllers: [PublicOptOutController],
  providers: [
    NotifyRecipientUseCase,
    OptOutByTrackingTokenUseCase,
    RecipientNotificationListener,
    { provide: DELIVERY_CONTACT_GATEWAY, useClass: DeliveryContactGateway },
    { provide: TRACKING_LINK_GATEWAY, useClass: TrackingLinkGateway },
    { provide: NOTIFICATION_REGISTRY, useClass: NotificationRepository },
    { provide: NOTIFICATION_SENDER, useClass: LoggingNotificationSender },
  ],
})
export class NotificationsModule {}
