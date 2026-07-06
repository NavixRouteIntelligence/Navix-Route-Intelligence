import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';

@Injectable()
export class DeleteDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const driver = await this.drivers.findById(tenantId, id);
    if (!driver) {
      throw new NotFoundError('Motorista não encontrado.');
    }
    await this.drivers.delete(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.driver.deleted',
      resource: `driver:${id}`,
    });
  }
}
