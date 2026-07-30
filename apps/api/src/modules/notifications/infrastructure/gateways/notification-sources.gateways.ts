import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
  type NotifiableDeliveryDto,
} from '../../../delivery/application/delivery-lookup.service';
import { IssueTrackingLinkUseCase } from '../../../public-tracking/application/issue-tracking-link.use-case';
import { QueryPositionsUseCase } from '../../../tracking/application/query-positions.use-case';
import type {
  DeliveryContactGatewayPort,
  NotifiableDelivery,
  TrackingLinkGatewayPort,
} from '../../application/ports/notification-sources.port';

/**
 * Adaptadores anti-corrupção do módulo de notificações (ADR-0084) — únicas
 * pontes para Delivery, PublicTracking e Tracking, sempre pelas **APIs
 * públicas** deles, nunca pelos repositórios.
 *
 * A direção só aponta para baixo (`notifications → {delivery, public-tracking,
 * tracking}`), então não há o ciclo que derrubou o boot na ADR-0082.
 */
@Injectable()
export class DeliveryContactGateway implements DeliveryContactGatewayPort {
  constructor(
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    private readonly positions: QueryPositionsUseCase,
  ) {}

  async find(tenantId: string, deliveryId: string): Promise<NotifiableDelivery | null> {
    const dto = await this.deliveries.getNotifiable(tenantId, deliveryId);
    return dto ? toDomain(dto) : null;
  }

  async activeForDriver(tenantId: string, driverId: string): Promise<NotifiableDelivery[]> {
    const items = await this.deliveries.listNotifiableActive(tenantId, driverId);
    return items.map(toDomain);
  }

  async activePendingNotification(tenantId: string): Promise<NotifiableDelivery[]> {
    const items = await this.deliveries.listNotifiableActive(tenantId);
    return items.map(toDomain);
  }

  async lastPositionOf(
    tenantId: string,
    driverId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const view = await this.positions.latestForDriver(tenantId, driverId);
    return view ? { latitude: view.latitude, longitude: view.longitude } : null;
  }
}

function toDomain(dto: NotifiableDeliveryDto): NotifiableDelivery {
  return {
    id: dto.id,
    recipient: dto.recipient,
    recipientEmail: dto.recipientEmail,
    recipientPhone: dto.recipientPhone,
    latitude: dto.latitude,
    longitude: dto.longitude,
    driverId: dto.driverId,
    status: dto.status,
  };
}

@Injectable()
export class TrackingLinkGateway implements TrackingLinkGatewayPort {
  constructor(private readonly issue: IssueTrackingLinkUseCase) {}

  /** A emissão é idempotente (ADR-0082): as quatro notificações reusam o link. */
  urlFor(tenantId: string, deliveryId: string): Promise<{ token: string; url: string }> {
    return this.issue.execute(tenantId, deliveryId);
  }
}
