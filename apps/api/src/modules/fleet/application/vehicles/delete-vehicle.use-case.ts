import { Inject, Injectable } from '@nestjs/common';

import { NotFoundError } from '../../../../shared/kernel/domain-error';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';

@Injectable()
export class DeleteVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const vehicle = await this.vehicles.findById(tenantId, id);
    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado.');
    }
    await this.vehicles.delete(tenantId, id);
  }
}
