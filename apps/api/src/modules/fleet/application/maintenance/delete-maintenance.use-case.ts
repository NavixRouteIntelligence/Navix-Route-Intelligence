import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import {
  MAINTENANCE_REPOSITORY,
  type MaintenanceRepositoryPort,
} from '../../domain/ports/maintenance-repository.port';

@Injectable()
export class DeleteMaintenanceUseCase {
  constructor(
    @Inject(MAINTENANCE_REPOSITORY) private readonly records: MaintenanceRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const existing = await this.records.findById(tenantId, id);
    if (!existing) throw new NotFoundError('Registro de manutenção não encontrado.');
    await this.records.delete(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.maintenance.deleted',
      resource: `maintenance:${id}`,
    });
  }
}
