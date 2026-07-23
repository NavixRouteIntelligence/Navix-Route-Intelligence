import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
  type DeliveryStopDto,
} from '../../../delivery/application/delivery-lookup.service';
import { classifyDestination } from '../../domain/destination-type';
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
    return (await this.lookup.getStops(tenantId, ids)).map(toStop);
  }

  async listActiveStops(tenantId: string): Promise<OptimizerDeliveryStop[]> {
    return (await this.lookup.listActive(tenantId)).map(toStop);
  }
}

function toStop(s: DeliveryStopDto): OptimizerDeliveryStop {
  // Classificação automática do destino a partir do endereço (ADR-0064). Fica no
  // Optimizer (não no Delivery) para não inverter a direção da dependência.
  const destinationType = classifyDestination(s.addressText, s.recipient);
  return {
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    priority: s.priority,
    timeWindow: s.timeWindow,
    ...(destinationType ? { destinationType } : {}),
  };
}
