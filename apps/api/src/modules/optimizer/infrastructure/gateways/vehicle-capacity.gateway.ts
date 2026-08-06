import { Inject, Injectable } from '@nestjs/common';

import {
  FLEET_LOOKUP,
  type FleetLookupPort,
} from '../../../fleet/application/fleet-lookup.service';
import type { VehicleCapacityPort } from '../../application/ports/vehicle-capacity.port';

/** Adaptador anti-corrupção do Optimizer para o Fleet (ADR-0109). */
@Injectable()
export class VehicleCapacityGateway implements VehicleCapacityPort {
  constructor(@Inject(FLEET_LOOKUP) private readonly fleet: FleetLookupPort) {}

  capacityOf(tenantId: string, vehicleId: string) {
    return this.fleet.vehicleCapacity(tenantId, vehicleId);
  }
}
