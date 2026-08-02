import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { ChangeDeliveryStatusUseCase } from '../../delivery/application/change-delivery-status.use-case';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';

import type {
  GeofenceStatusAutomationInput,
  GeofenceStatusAutomationPort,
} from './ports/geofence-status-automation.port';
import { QueryPositionsUseCase } from './query-positions.use-case';

/**
 * Promove uma entrega `pending` para `in_route` quando o motorista permanece no
 * geofence do destino. Estados terminais e POD continuam exclusivamente sob
 * ação humana. A avaliação é limitada por motorista e lê o rastro uma só vez.
 */
@Injectable()
export class GeofenceStatusAutomationService implements GeofenceStatusAutomationPort {
  private readonly logger = new Logger('GeofenceStatusAutomation');
  private readonly lastCheck = new Map<string, number>();
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly config: AppConfigService,
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    private readonly positions: QueryPositionsUseCase,
    private readonly changeStatus: ChangeDeliveryStatusUseCase,
  ) {}

  async evaluate(input: GeofenceStatusAutomationInput): Promise<number> {
    const config = this.config.tracking;
    if (!config.geofenceAutomationEnabled) return 0;

    const key = `${input.tenantId}:${input.driverId}`;
    const now = input.recordedAt.getTime();
    const last = this.lastCheck.get(key) ?? 0;
    if (now - last < config.geofenceCheckIntervalMs || this.inFlight.has(key)) return 0;

    this.lastCheck.set(key, now);
    this.inFlight.add(key);
    try {
      const pending = (
        await this.deliveries.listNotifiableActive(input.tenantId, input.driverId)
      ).filter((delivery) => delivery.status === 'pending');
      if (pending.length === 0) return 0;

      const dwellByDelivery = await this.positions.serviceMinutesAtStops(
        input.tenantId,
        input.driverId,
        pending,
        input.recordedAt,
      );

      let changed = 0;
      for (const delivery of pending) {
        const dwell = dwellByDelivery.get(delivery.id);
        if (dwell == null || dwell < config.geofenceDwellMinutes) continue;
        try {
          await this.changeStatus.execute({
            tenantId: input.tenantId,
            id: delivery.id,
            actorId: input.driverId,
            status: 'in_route',
          });
          changed += 1;
        } catch (error) {
          // Outra réplica ou ação manual pode vencer a transição; as demais
          // entregas do mesmo local ainda devem ser avaliadas.
          this.logger.warn(
            `Falha ao automatizar ${delivery.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      return changed;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
