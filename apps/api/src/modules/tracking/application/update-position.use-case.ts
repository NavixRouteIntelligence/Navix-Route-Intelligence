import { Inject, Injectable } from '@nestjs/common';
import type { DriverPositionView, PositionUpdateRequest } from '@navix/contracts';

import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
import {
  TRACKING_EVENTS,
  type TrackingEventsPort,
} from '../domain/ports/tracking-events.port';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { createDriverPosition } from './create-driver-position';
import { toPositionView } from './position.mapper';

export interface UpdatePositionCommand extends PositionUpdateRequest {
  tenantId: string;
  /** Motorista que reporta = usuário autenticado. */
  driverId: string;
}

/** Registra uma nova posição do motorista (append-only). */
@Injectable()
export class UpdatePositionUseCase {
  constructor(
    @Inject(POSITION_REPOSITORY) private readonly positions: PositionRepositoryPort,
    @Inject(TRACKING_EVENTS) private readonly events: TrackingEventsPort,
    private readonly bus: DomainEventBus,
  ) {}

  async execute(command: UpdatePositionCommand): Promise<DriverPositionView> {
    const position = createDriverPosition(command);
    await this.positions.save(position);
    const view = toPositionView(position);
    // Publica em tempo real (SSE); o polling permanece como fallback.
    this.events.positionUpdated(command.tenantId, view);
    // E no barramento de domínio: é o *tick* que faz o Optimizer reavaliar se a
    // rota atrasou (ADR-0083). Este evento NÃO reotimiza por si só — quem
    // dispara é o `route.delay-detected` que o detector publica.
    this.bus.publish(command.tenantId, {
      type: 'tracking.position-recorded',
      aggregateId: command.driverId,
    });
    return view;
  }
}
