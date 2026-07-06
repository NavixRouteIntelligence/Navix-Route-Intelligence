import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';

@Injectable()
export class DeleteVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const vehicle = await this.vehicles.findById(tenantId, id);
    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado.');
    }
    await this.vehicles.delete(tenantId, id);
    await this.audit.record({
      tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.vehicle.deleted',
      resource: `vehicle:${id}`,
    });
  }
}
