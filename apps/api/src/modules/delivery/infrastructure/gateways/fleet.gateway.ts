import { Inject, Injectable } from '@nestjs/common';

import { FLEET_LOOKUP, type FleetLookupPort } from '../../../fleet/application/fleet-lookup.service';
import type { FleetGatewayPort } from '../../application/ports/fleet-gateway.port';

/**
 * Adaptador anti-corrupção: única ponte do Delivery para o Fleet. Traduz a
 * porta do Delivery (FleetGatewayPort) para a API pública do Fleet (FleetLookup).
 */
@Injectable()
export class FleetGateway implements FleetGatewayPort {
  constructor(@Inject(FLEET_LOOKUP) private readonly lookup: FleetLookupPort) {}

  vehicleExists(tenantId: string, vehicleId: string): Promise<boolean> {
    return this.lookup.vehicleExists(tenantId, vehicleId);
  }

  driverExists(tenantId: string, driverId: string): Promise<boolean> {
    return this.lookup.driverExists(tenantId, driverId);
  }
}
