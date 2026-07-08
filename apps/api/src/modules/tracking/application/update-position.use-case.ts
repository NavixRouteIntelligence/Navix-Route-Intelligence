import { Inject, Injectable } from '@nestjs/common';
import type { DriverPositionView, PositionUpdateRequest } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import type { DriverPosition } from '../domain/driver-position';
import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
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
  ) {}

  async execute(command: UpdatePositionCommand): Promise<DriverPositionView> {
    if (
      !Number.isFinite(command.latitude) ||
      command.latitude < -90 ||
      command.latitude > 90 ||
      !Number.isFinite(command.longitude) ||
      command.longitude < -180 ||
      command.longitude > 180
    ) {
      throw new ValidationError('Coordenadas inválidas.');
    }

    const position: DriverPosition = {
      id: newId(),
      tenantId: command.tenantId,
      driverId: command.driverId,
      latitude: command.latitude,
      longitude: command.longitude,
      speed: command.speed ?? null,
      heading: command.heading ?? null,
      status: command.status ?? 'en_route',
      recordedAt: command.recordedAt ? new Date(command.recordedAt) : new Date(),
    };

    await this.positions.save(position);
    return toPositionView(position);
  }
}
