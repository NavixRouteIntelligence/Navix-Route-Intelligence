import { Inject, Injectable } from '@nestjs/common';
import type { Delivery as DeliveryView, UpdateDeliveryRequest } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { assertAssociationsExist } from './associations.validator';
import { toDeliveryView } from './mappers/delivery.mapper';
import { FLEET_GATEWAY, type FleetGatewayPort } from './ports/fleet-gateway.port';

export type UpdateDeliveryCommand = UpdateDeliveryRequest & {
  tenantId: string;
  id: string;
  actorId: string;
};

@Injectable()
export class UpdateDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(FLEET_GATEWAY) private readonly fleet: FleetGatewayPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly events: DomainEventBus,
  ) {}

  async execute(command: UpdateDeliveryCommand): Promise<DeliveryView> {
    const delivery = await this.deliveries.findById(command.tenantId, command.id);
    if (!delivery) {
      throw new NotFoundError('Entrega não encontrada.');
    }

    await assertAssociationsExist(this.fleet, command.tenantId, command);

    delivery.update(command);
    await this.deliveries.save(delivery);

    const view = toDeliveryView(delivery);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'delivery.updated',
      resource: `delivery:${view.id}`,
    });
    this.events.publish(command.tenantId, { type: 'delivery.updated', aggregateId: view.id });
    return view;
  }
}
