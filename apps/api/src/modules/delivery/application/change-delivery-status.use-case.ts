import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryStatus, Delivery as DeliveryView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { toDeliveryView } from './mappers/delivery.mapper';

export interface ChangeDeliveryStatusCommand {
  tenantId: string;
  id: string;
  actorId: string;
  status: DeliveryStatus;
}

@Injectable()
export class ChangeDeliveryStatusUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: ChangeDeliveryStatusCommand): Promise<DeliveryView> {
    const delivery = await this.deliveries.findById(command.tenantId, command.id);
    if (!delivery) {
      throw new NotFoundError('Entrega não encontrada.');
    }

    const from = delivery.status;
    delivery.changeStatus(command.status); // valida a transição (máquina de estados)
    await this.deliveries.save(delivery);

    const view = toDeliveryView(delivery);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'delivery.status_changed',
      resource: `delivery:${view.id}`,
      metadata: { from, to: view.status },
    });
    return view;
  }
}
