import type { DriverPositionView } from '@navix/contracts';

import { type DriverPosition, effectiveStatus } from '../domain/driver-position';

/** Converte a posição de domínio em view, já aplicando o status efetivo. */
export function toPositionView(position: DriverPosition, now: Date = new Date()): DriverPositionView {
  return {
    driverId: position.driverId,
    latitude: position.latitude,
    longitude: position.longitude,
    recordedAt: position.recordedAt.toISOString(),
    speed: position.speed,
    heading: position.heading,
    status: effectiveStatus(position.status, position.recordedAt, now),
  };
}
