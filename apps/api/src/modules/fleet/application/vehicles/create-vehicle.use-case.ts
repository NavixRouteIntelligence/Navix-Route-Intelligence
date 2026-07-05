import { Inject, Injectable } from '@nestjs/common';
import type { CreateVehicleRequest, Vehicle as VehicleView } from '@navix/contracts';

import { ConflictError } from '../../../../shared/kernel/domain-error';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { Vehicle } from '../../domain/vehicle';
import { toVehicleView } from '../mappers/vehicle.mapper';

export type CreateVehicleCommand = CreateVehicleRequest & { tenantId: string };

@Injectable()
export class CreateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
  ) {}

  async execute(command: CreateVehicleCommand): Promise<VehicleView> {
    const vehicle = Vehicle.create(command);

    if (await this.vehicles.existsByPlate(command.tenantId, vehicle.plate)) {
      throw new ConflictError('Já existe um veículo com esta placa.');
    }

    await this.vehicles.save(vehicle);
    return toVehicleView(vehicle);
  }
}
