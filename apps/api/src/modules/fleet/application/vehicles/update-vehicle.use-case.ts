import { Inject, Injectable } from '@nestjs/common';
import type { UpdateVehicleRequest, Vehicle as VehicleView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { ConflictError, NotFoundError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { toVehicleView } from '../mappers/vehicle.mapper';

export type UpdateVehicleCommand = UpdateVehicleRequest & { tenantId: string; id: string };

@Injectable()
export class UpdateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: UpdateVehicleCommand): Promise<VehicleView> {
    const vehicle = await this.vehicles.findById(command.tenantId, command.id);
    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado.');
    }

    vehicle.update(command);

    if (
      command.plate !== undefined &&
      (await this.vehicles.existsByPlate(command.tenantId, vehicle.plate, command.id))
    ) {
      throw new ConflictError('Já existe um veículo com esta placa.');
    }

    await this.vehicles.save(vehicle);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.vehicle.updated',
      resource: `vehicle:${command.id}`,
    });
    return toVehicleView(vehicle);
  }
}
