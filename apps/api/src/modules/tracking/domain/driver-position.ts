import type { TrackingStatus } from '@navix/contracts';

/** Posição registrada de um motorista (sem dependências de framework/ORM). */
export interface DriverPosition {
  id: string;
  tenantId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  speed: number | null;
  heading: number | null;
  status: TrackingStatus;
}

/** Após este intervalo sem novas posições, o motorista é considerado `offline`. */
export const OFFLINE_AFTER_MS = 2 * 60 * 1000;

/**
 * Status efetivo: se a última posição está velha demais, o motorista é `offline`
 * independentemente do que foi reportado. Função pura (testável).
 */
export function effectiveStatus(
  stored: TrackingStatus,
  recordedAt: Date,
  now: Date = new Date(),
): TrackingStatus {
  if (stored === 'finished') return 'finished';
  const ageMs = now.getTime() - recordedAt.getTime();
  return ageMs > OFFLINE_AFTER_MS ? 'offline' : stored;
}
