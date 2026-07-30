import type { CreateVehicleRequest, Vehicle as VehicleView } from '@navix/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { ConflictError, ForbiddenError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { Vehicle } from '../../domain/vehicle';
import { toVehicleView } from '../mappers/vehicle.mapper';

export type CreateVehicleCommand = CreateVehicleRequest & {
  tenantId: string;
  actorId: string;
  actorRoles: string[];
};

@Injectable()
export class CreateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: CreateVehicleCommand): Promise<VehicleView> {
    await this.assertCanCreate(command);
    const vehicle = Vehicle.create(command);

    if (await this.vehicles.existsByPlate(command.tenantId, vehicle.plate)) {
      throw new ConflictError('Já existe um veículo com esta placa.');
    }

    await this.vehicles.save(vehicle);
    const view = toVehicleView(vehicle);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.vehicle.created',
      resource: `vehicle:${view.id}`,
    });
    return view;
  }

  /**
   * Admin/gestor cadastra a frota. Um `driver` só pode cadastrar quando não
   * possui ficha ligada neste tenant — distinção entre autônomo e motorista
   * convidado de empresa (ADR-0085/0086).
   */
  private async assertCanCreate(command: CreateVehicleCommand): Promise<void> {
    const privileged = command.actorRoles.some(
      (role) => role === 'admin' || role === 'fleet_manager',
    );
    if (privileged) return;

    const autonomous =
      command.actorRoles.includes('driver') &&
      !(await this.drivers.existsByUser(command.tenantId, command.actorId));
    if (!autonomous) {
      throw new ForbiddenError('Motoristas vinculados a uma empresa não podem cadastrar veículos.');
    }
  }
}
