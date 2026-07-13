import { Inject, Injectable } from '@nestjs/common';
import type { DriverPositionView, PositionUpdateRequest } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
import {
  TRACKING_EVENTS,
  type TrackingEventsPort,
} from '../domain/ports/tracking-events.port';
import { createDriverPosition } from './create-driver-position';
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
  constructor(
    @Inject(POSITION_REPOSITORY) private readonly positions: PositionRepositoryPort,
    @Inject(TRACKING_EVENTS) private readonly events: TrackingEventsPort,
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
    return views;
  }
}
