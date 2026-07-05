import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../../delivery/application/delivery-lookup.service';
import type {
  DeliveryGatewayPort,
  OptimizerDeliveryStop,
} from '../../application/ports/delivery-gateway.port';

/**
 * Adaptador anti-corrupção: única ponte do Optimizer para o Delivery. Consome a
 * API pública do Delivery (DeliveryLookup) — sem acessar internals daquele módulo.
 */
@Injectable()
export class DeliveryGateway implements DeliveryGatewayPort {
  constructor(@Inject(DELIVERY_LOOKUP) private readonly lookup: DeliveryLookupPort) {}

  async getStops(tenantId: string, ids: string[]): Promise<OptimizerDeliveryStop[]> {
    const stops = await this.lookup.getStops(tenantId, ids);
    return stops.map((s) => ({
      id: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      priority: s.priority,
      timeWindow: s.timeWindow,
    }));
  }
}
