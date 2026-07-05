import { Inject, Injectable } from '@nestjs/common';
import type { CreateDeliveryRequest, Delivery as DeliveryView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { Delivery } from '../domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { assertAssociationsExist } from './associations.validator';
import { toDeliveryView } from './mappers/delivery.mapper';
import { FLEET_GATEWAY, type FleetGatewayPort } from './ports/fleet-gateway.port';

export type CreateDeliveryCommand = CreateDeliveryRequest & {
  tenantId: string;
  actorId: string;
};

@Injectable()
export class CreateDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(FLEET_GATEWAY) private readonly fleet: FleetGatewayPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: CreateDeliveryCommand): Promise<DeliveryView> {
    await assertAssociationsExist(this.fleet, command.tenantId, command);

    const delivery = Delivery.create(command);
    await this.deliveries.save(delivery);

    const view = toDeliveryView(delivery);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'delivery.created',
      resource: `delivery:${view.id}`,
      metadata: { status: view.status, priority: view.priority },
    });
    return view;
  }
}
