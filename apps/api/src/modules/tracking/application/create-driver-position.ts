import type { PositionUpdateRequest } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import type { DriverPosition } from '../domain/driver-position';

export interface PositionInput extends PositionUpdateRequest {
  tenantId: string;
  driverId: string;
}

/**
 * Valida e constrói uma `DriverPosition` a partir da requisição. Compartilhado
 * pelo envio unitário e pelo envio em lote, garantindo a mesma validação.
 */
export function createDriverPosition(input: PositionInput): DriverPosition {
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new ValidationError('Coordenadas inválidas.');
  }

  return {
    id: newId(),
    tenantId: input.tenantId,
    driverId: input.driverId,
    latitude: input.latitude,
    longitude: input.longitude,
    speed: input.speed ?? null,
    heading: input.heading ?? null,
    status: input.status ?? 'en_route',
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
  };
}
