import { Inject, Injectable } from '@nestjs/common';
import type { Vehicle as VehicleView } from '@navix/contracts';

import { NotFoundError } from '../../../../shared/kernel/domain-error';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { toVehicleView } from '../mappers/vehicle.mapper';

@Injectable()
export class GetVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<VehicleView> {
    const vehicle = await this.vehicles.findById(tenantId, id);
    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado.');
    }
    return toVehicleView(vehicle);
  }
}
