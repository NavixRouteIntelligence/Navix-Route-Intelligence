import type { GeoPoint } from '../geo-point';

/**
 * Fonte de distância abstraída. MVP: Haversine (great-circle). Futuro: matriz
 * real com trânsito — troca sem afetar o motor (ver plano do Optimizer).
 */
export interface DistanceProviderPort {
  /** Distância em quilômetros entre dois pontos. */
  distanceKm(a: GeoPoint, b: GeoPoint): number;
}

export const DISTANCE_PROVIDER = Symbol('DISTANCE_PROVIDER');
