import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';

/** Exclusão lógica (soft delete) — mantém a entrega para auditoria/histórico. */
@Injectable()
export class DeleteDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(tenantId: string, id: string, actorId: string): Promise<void> {
    const delivery = await this.deliveries.findById(tenantId, id);
    if (!delivery) {
      throw new NotFoundError('Entrega não encontrada.');
    }

    delivery.softDelete();
    await this.deliveries.save(delivery);

    await this.audit.record({
      tenantId,
      actorId,
      action: 'delivery.deleted',
      resource: `delivery:${id}`,
    });
  }
}
