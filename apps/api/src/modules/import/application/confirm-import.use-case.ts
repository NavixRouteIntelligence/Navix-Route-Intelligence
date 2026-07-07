import { Inject, Injectable } from '@nestjs/common';
import type { ConfirmImportResponse } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_CREATOR,
  type DeliveryCreatorPort,
} from '../domain/ports/delivery-creator.port';
import {
  IMPORT_BATCH_REPOSITORY,
  type ImportBatchRepositoryPort,
} from '../domain/ports/import-batch-repository.port';
import { ROUTE_ESTIMATOR, type RouteEstimatorPort } from '../domain/ports/route-estimator.port';
import { toBatchView } from './mappers/import.mapper';

export interface ConfirmImportCommand {
  tenantId: string;
  actorId: string;
  batchId: string;
  optimize: boolean;
}

@Injectable()
export class ConfirmImportUseCase {
  constructor(
    @Inject(IMPORT_BATCH_REPOSITORY) private readonly repo: ImportBatchRepositoryPort,
    @Inject(DELIVERY_CREATOR) private readonly deliveries: DeliveryCreatorPort,
    @Inject(ROUTE_ESTIMATOR) private readonly estimator: RouteEstimatorPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: ConfirmImportCommand): Promise<ConfirmImportResponse> {
    const batch = await this.repo.findById(command.tenantId, command.batchId);
    if (!batch) {
      throw new NotFoundError('Importação não encontrada.');
    }
    if (batch.status !== 'preview') {
      throw new ConflictError('Esta importação já foi confirmada.');
    }

    const deliveryIds: string[] = [];
    for (const row of batch.importableRows) {
      if (!row.resolved || row.latitude === null || row.longitude === null) continue;
      const id = await this.deliveries.create({
        tenantId: command.tenantId,
        actorId: command.actorId,
        ...row.resolved,
        latitude: row.latitude,
        longitude: row.longitude,
        priority: row.priority,
        notes: row.notes,
      });
      deliveryIds.push(id);
    }

    let routePlanId: string | null = null;
    if (command.optimize && deliveryIds.length >= 2) {
      routePlanId = await this.estimator.optimize(command.tenantId, command.actorId, deliveryIds);
    }

    batch.markImported(deliveryIds.length, routePlanId);
    await this.repo.save(batch);

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'import.confirmed',
      resource: `import:${batch.id}`,
      metadata: { created: deliveryIds.length, routePlanId },
    });

    return { batch: toBatchView(batch), createdDeliveries: deliveryIds.length, routePlanId };
  }
}
