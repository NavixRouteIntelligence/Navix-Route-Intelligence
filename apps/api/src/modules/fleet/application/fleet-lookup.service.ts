import { Inject, Injectable } from '@nestjs/common';

import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../domain/ports/driver-repository.port';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../domain/ports/vehicle-repository.port';

/**
 * API pública do contexto Fleet, consumida por outros módulos (ex.: Delivery)
 * através de suas próprias portas anti-corrupção. É o único ponto de entrada
 * externo ao Fleet — internals (entidades, repositórios) permanecem privados.
 */
export interface FleetLookupPort {
  vehicleExists(tenantId: string, vehicleId: string): Promise<boolean>;
  driverExists(tenantId: string, driverId: string): Promise<boolean>;
}

export const FLEET_LOOKUP = Symbol('FLEET_LOOKUP');

@Injectable()
export class FleetLookupService implements FleetLookupPort {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
  ) {}

  async vehicleExists(tenantId: string, vehicleId: string): Promise<boolean> {
    return (await this.vehicles.findById(tenantId, vehicleId)) !== null;
  }

  async driverExists(tenantId: string, driverId: string): Promise<boolean> {
    return (await this.drivers.findById(tenantId, driverId)) !== null;
  }
}
