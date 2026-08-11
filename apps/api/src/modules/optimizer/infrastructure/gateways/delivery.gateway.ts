import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
  type DeliveryStopDto,
} from '../../../delivery/application/delivery-lookup.service';
import type { DeliveryOwnership } from '../../domain/delivery-ownership';
import { classifyDestination } from '../../domain/destination-type';
import type {
  DeliveryGatewayPort,
  OptimizerDeliveryStop,
  RouteViewDeliveryStop,
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

  async getRouteStops(tenantId: string, ids: string[]): Promise<RouteViewDeliveryStop[]> {
    const found = await this.lookup.getStops(tenantId, ids);
    return found.map((s) => ({
      id: s.id,
      addressText: s.addressText?.trim() || null,
      status: s.status,
      priority: s.priority,
      timeWindow: s.timeWindow,
      // Coordenada inválida vira ausência declarada, não um ponto no oceano.
      latitude: isValidLat(s.latitude) && isValidLng(s.longitude) ? s.latitude : null,
      longitude: isValidLat(s.latitude) && isValidLng(s.longitude) ? s.longitude : null,
    }));
  }

  getOwnership(tenantId: string, ids: string[]): Promise<DeliveryOwnership[]> {
    return this.lookup.getOwnership(tenantId, ids);
  }

  async listActiveStops(tenantId: string): Promise<OptimizerDeliveryStop[]> {
    return (await this.lookup.listActive(tenantId)).map(toStop);
  }
}

const isValidLat = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isValidLng = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

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
    weightKg: s.weightKg,
    volumeM3: s.volumeM3,
    vehicleId: s.vehicleId,
    ...(destinationType ? { destinationType } : {}),
  };
}
