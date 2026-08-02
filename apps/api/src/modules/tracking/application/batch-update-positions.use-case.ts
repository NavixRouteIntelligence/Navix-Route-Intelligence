import type { DriverPositionView, PositionUpdateRequest } from '@navix/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { ValidationError } from '../../../shared/kernel/domain-error';
import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
import { TRACKING_EVENTS, type TrackingEventsPort } from '../domain/ports/tracking-events.port';

import { createDriverPosition } from './create-driver-position';
import { DRIVER_ACCOUNT_LINK, type DriverAccountLinkPort } from './ports/driver-account-link.port';
import {
  GEOFENCE_STATUS_AUTOMATION,
  type GeofenceStatusAutomationPort,
} from './ports/geofence-status-automation.port';
import { toPositionView } from './position.mapper';

export interface BatchUpdatePositionsCommand {
  tenantId: string;
  driverId: string;
  positions: PositionUpdateRequest[];
}

/**
 * Registra **várias** posições do motorista numa única operação — pensado para a
 * **sincronização offline** (o dispositivo acumula posições sem sinal e as envia
 * ao reconectar). Grava tudo num único INSERT e publica cada uma em tempo real.
 */
@Injectable()
export class BatchUpdatePositionsUseCase {
  private readonly logger = new Logger(BatchUpdatePositionsUseCase.name);

  constructor(
    @Inject(POSITION_REPOSITORY) private readonly positions: PositionRepositoryPort,
    @Inject(TRACKING_EVENTS) private readonly events: TrackingEventsPort,
    @Inject(DRIVER_ACCOUNT_LINK) private readonly link: DriverAccountLinkPort,
    private readonly bus: DomainEventBus,
    @Inject(GEOFENCE_STATUS_AUTOMATION)
    private readonly geofenceAutomation: GeofenceStatusAutomationPort,
  ) {}

  async execute(command: BatchUpdatePositionsCommand): Promise<DriverPositionView[]> {
    if (command.positions.length === 0) {
      throw new ValidationError('Envie ao menos uma posição.');
    }

    const built = command.positions.map((p) =>
      createDriverPosition({ ...p, tenantId: command.tenantId, driverId: command.driverId }),
    );

    await this.positions.saveMany(built);

    const views = built.map((p) => toPositionView(p));
    for (const view of views) {
      this.events.positionUpdated(command.tenantId, view);
    }
    const latest = built.reduce((a, b) => (a.recordedAt >= b.recordedAt ? a : b));
    const announcedId = await this.fleetDriverId(command.tenantId, command.driverId);
    this.bus.publish(command.tenantId, {
      type: 'tracking.position-recorded',
      aggregateId: announcedId,
    });
    await this.automateStatus(command.tenantId, announcedId, latest.recordedAt);
    return views;
  }

  private async fleetDriverId(tenantId: string, userId: string): Promise<string> {
    try {
      const fichas = await this.link.driverIdsForUsers(tenantId, [userId]);
      return fichas.get(userId) ?? userId;
    } catch {
      return userId;
    }
  }

  private async automateStatus(
    tenantId: string,
    driverId: string,
    recordedAt: Date,
  ): Promise<void> {
    try {
      await this.geofenceAutomation.evaluate({ tenantId, driverId, recordedAt });
    } catch (error) {
      this.logger.warn(
        `Automação de geofence falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
