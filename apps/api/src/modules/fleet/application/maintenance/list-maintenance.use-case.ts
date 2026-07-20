import { Inject, Injectable } from '@nestjs/common';
import type { MaintenanceRecord as MaintenanceView } from '@navix/contracts';

import { NotFoundError } from '../../../../shared/kernel/domain-error';
import {
  MAINTENANCE_REPOSITORY,
  type MaintenanceRepositoryPort,
} from '../../domain/ports/maintenance-repository.port';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { toMaintenanceView } from '../mappers/maintenance.mapper';

@Injectable()
export class ListMaintenanceUseCase {
  constructor(
    @Inject(MAINTENANCE_REPOSITORY) private readonly records: MaintenanceRepositoryPort,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
  ) {}

  async execute(tenantId: string, vehicleId: string): Promise<MaintenanceView[]> {
    const vehicle = await this.vehicles.findById(tenantId, vehicleId);
    if (!vehicle) throw new NotFoundError('Veículo não encontrado.');
    const records = await this.records.findByVehicle(tenantId, vehicleId);
    return records.map(toMaintenanceView);
  }
}
