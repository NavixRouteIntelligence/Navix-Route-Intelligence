import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../../delivery/application/delivery-lookup.service';
import type { DeliveryCountPort } from '../../application/ports/delivery-count.port';

/**
 * Adaptador anti-corrupção: única ponte do Finance para o Delivery. Consome a
 * API pública (DeliveryLookup) — sem acessar internals daquele módulo (ADR-0069).
 */
@Injectable()
export class DeliveryCountGateway implements DeliveryCountPort {
  constructor(@Inject(DELIVERY_LOOKUP) private readonly lookup: DeliveryLookupPort) {}

  countDeliveredInRange(tenantId: string, from: Date, to: Date): Promise<number> {
    return this.lookup.countDeliveredInRange(tenantId, from, to);
  }
}
