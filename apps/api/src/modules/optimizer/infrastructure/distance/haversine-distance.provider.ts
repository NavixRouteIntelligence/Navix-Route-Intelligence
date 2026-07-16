import { Injectable } from '@nestjs/common';

import { haversineKm } from '../../../../shared/kernel/geo';
import type { GeoPoint } from '../../domain/geo-point';
import type { DistanceProviderPort } from '../../domain/ports/distance-provider.port';

/**
 * Distância great-circle (Haversine) em km. Delega ao **kernel geográfico único**
 * (`shared/kernel/geo`, ADR-0042) — sem reimplementar a fórmula. `GeoPoint` é
 * estruturalmente um `LatLng`. Substituível por matriz real (ADR-0007).
 */
@Injectable()
export class HaversineDistanceProvider implements DistanceProviderPort {
  distanceKm(a: GeoPoint, b: GeoPoint): number {
    return haversineKm(a, b);
  }
}
