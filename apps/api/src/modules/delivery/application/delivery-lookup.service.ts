import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPriority, TimeWindow } from '@navix/contracts';

import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';

/** Parada exportada para consumo externo (ex.: Optimizer). */
export interface DeliveryStopDto {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow | null;
}

/**
 * API pública do contexto Delivery. Expõe apenas o necessário para outros
 * módulos (ex.: Optimizer) sem revelar o agregado/repositório internos.
 */
export interface DeliveryLookupPort {
  getStops(tenantId: string, ids: string[]): Promise<DeliveryStopDto[]>;
}

export const DELIVERY_LOOKUP = Symbol('DELIVERY_LOOKUP');

@Injectable()
export class DeliveryLookupService implements DeliveryLookupPort {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
  ) {}

  async getStops(tenantId: string, ids: string[]): Promise<DeliveryStopDto[]> {
    const found = await this.deliveries.findByIds(tenantId, ids);
    return found.map((d) => {
      const s = d.snapshot();
      const address = s.address.snapshot();
      return {
        id: s.id,
        latitude: address.latitude,
        longitude: address.longitude,
        priority: s.priority,
        timeWindow: {
          start: s.timeWindow.start.toISOString(),
          end: s.timeWindow.end.toISOString(),
        },
      };
    });
  }
}
